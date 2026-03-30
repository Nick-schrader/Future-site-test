// Queue system to prevent data overlap in concurrent operations
class OperationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Add operation to queue
  async add(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...operation,
        resolve,
        reject,
        attempts: 0,
        timestamp: Date.now()
      });
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  // Process queue one item at a time
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        await this.executeOperation(item);
        item.resolve(item.result);
      } catch (error) {
        item.attempts++;
        
        if (item.attempts < this.maxRetries) {
          console.log(`[QUEUE] Operation failed, retry ${item.attempts}/${this.maxRetries}:`, error.message);
          // Add back to queue with delay
          setTimeout(() => {
            this.queue.unshift(item);
          }, this.retryDelay * item.attempts);
        } else {
          console.error(`[QUEUE] Operation failed after ${item.maxRetries} attempts:`, error);
          item.reject(error);
        }
      }
    }

    this.processing = false;
  }

  // Execute individual operation
  async executeOperation(item) {
    const { type, data, execute } = item;
    
    console.log(`[QUEUE] Processing ${type} operation for user: ${data.userId || 'unknown'}`);
    
    // Execute the operation function
    const result = await execute(data);
    
    // Store result for potential use
    item.result = result;
    
    console.log(`[QUEUE] Completed ${type} operation`);
    
    return result;
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      nextOperation: this.queue[0] ? {
        type: this.queue[0].type,
        userId: this.queue[0].data.userId,
        waitTime: Date.now() - this.queue[0].timestamp
      } : null
    };
  }

  // Clear queue (for emergency situations)
  clear() {
    const cleared = this.queue.length;
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    this.processing = false;
    return cleared;
  }
}

// Create separate queues for different operation types
const discordQueue = new OperationQueue(); // For Discord API operations
const databaseQueue = new OperationQueue(); // For database operations
const indelingQueue = new OperationQueue(); // For indeling operations (most critical)

// Export queues and helper functions
module.exports = {
  OperationQueue,
  discordQueue,
  databaseQueue,
  indelingQueue,
  
  // Helper function to add Discord operations
  async addDiscordOperation(type, data, executeFn) {
    return discordQueue.add({
      type: `discord_${type}`,
      data,
      execute: executeFn
    });
  },

  // Helper function to add database operations
  async addDatabaseOperation(type, data, executeFn) {
    return databaseQueue.add({
      type: `database_${type}`,
      data,
      execute: executeFn
    });
  },

  // Helper function to add indeling operations
  async addIndelingOperation(type, data, executeFn) {
    return indelingQueue.add({
      type: `indeling_${type}`,
      data,
      execute: executeFn
    });
  },

  // Get all queue statuses
  getQueueStatuses() {
    return {
      discord: discordQueue.getStatus(),
      database: databaseQueue.getStatus(),
      indeling: indelingQueue.getStatus()
    };
  }
};
