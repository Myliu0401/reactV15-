/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactUpdates
 */

'use strict';

var CallbackQueue = require('CallbackQueue');
var PooledClass = require('PooledClass');
var ReactFeatureFlags = require('ReactFeatureFlags');
var ReactPerf = require('ReactPerf');
var ReactReconciler = require('ReactReconciler');
var Transaction = require('Transaction');

var invariant = require('invariant');

var dirtyComponents = []; // 存储要更新的类组件初始化的实例

var asapCallbackQueue = CallbackQueue.getPooled();
var asapEnqueued = false;

var batchingStrategy = null;  // 该属性最终会是这个 ReactDefaultBatchingStrategy对象

function ensureInjected() {  
  invariant(
    ReactUpdates.ReactReconcileTransaction && batchingStrategy,
    'ReactUpdates: must inject a reconcile transaction class and batching ' +
    'strategy'
  );
}

var NESTED_UPDATES = {
  initialize: function() {
    this.dirtyComponentsLength = dirtyComponents.length;
  },
  close: function() {
    if (this.dirtyComponentsLength !== dirtyComponents.length) {
      
      dirtyComponents.splice(0, this.dirtyComponentsLength);
      flushBatchedUpdates();
    } else {
      dirtyComponents.length = 0;
    }
  },
};

var UPDATE_QUEUEING = {
  initialize: function() {
    this.callbackQueue.reset();
  },
  close: function() {
    this.callbackQueue.notifyAll();
  },
};

var TRANSACTION_WRAPPERS = [NESTED_UPDATES, UPDATE_QUEUEING];

// 更新事务
function ReactUpdatesFlushTransaction() {
  this.reinitializeTransaction(); // 该函数会重置队列数组
  /* 
      该函数中会调用getTransactionWrappers函数并且将返回值赋给 this.transactionWrappers
  
  */



  this.dirtyComponentsLength = null;

  this.callbackQueue = CallbackQueue.getPooled();
  /* 
      callbackQueue为一个对象该对象中拥有以下属性
        _callbacks: null
        _contexts: null
  */

  this.reconcileTransaction = ReactUpdates.ReactReconcileTransaction.getPooled(true);
};




Object.assign(
  ReactUpdatesFlushTransaction.prototype,
  Transaction.Mixin,
  {
    getTransactionWrappers: function() {
      return TRANSACTION_WRAPPERS;
    },

    destructor: function() {
      this.dirtyComponentsLength = null;
      CallbackQueue.release(this.callbackQueue);
      this.callbackQueue = null;
      ReactUpdates.ReactReconcileTransaction.release(this.reconcileTransaction);
      this.reconcileTransaction = null;
    },

    perform: function(method, scope, a) {
      return Transaction.Mixin.perform.call(
        this,
        this.reconcileTransaction.perform,
        this.reconcileTransaction,
        method,
        scope,
        a
      );
    },
  }
);
    
// 向该ReactUpdatesFlushTransaction函数注入静态属性
PooledClass.addPoolingTo(ReactUpdatesFlushTransaction);
/* 
     注入后该函数将增加以下静态成员
      instancePool为空数组
      getPooled为PooledClass模块中的oneArgumentPooler函数
      poolSize为10
      release为PooledClass模块中的standardReleaser函数


*/


/**
 * 
 * @param {*} callback 回调函数
 * @param {*} a      //首次执行时 组件初始化实例
 * @param {*} b      //首次执行时 要渲染到的容器
 * @param {*} c      //首次执行时 是否越过该标记插入
 * @param {*} d      //首次执行时 首次渲染时context为emptyObject
 * @param {*} e 
 */
function batchedUpdates(callback, a, b, c, d, e) {
  ensureInjected(); // 处理一些不知道干啥的东西

  batchingStrategy.batchedUpdates(callback, a, b, c, d, e);  // 进入控制是否批量更新
};



/**
 * Array comparator for ReactComponents by mount ordering.
 *
 * @param {ReactComponent} c1 first component you're comparing
 * @param {ReactComponent} c2 second component you're comparing
 * @return {number} Return value usable by Array.prototype.sort().
 */
function mountOrderComparator(c1, c2) {
  return c1._mountOrder - c2._mountOrder;
}


/**
 * 
 * @param {*} transaction 事务
 */
function runBatchedUpdates(transaction) {
  var len = transaction.dirtyComponentsLength;
  invariant(
    len === dirtyComponents.length,
    'Expected flush transaction\'s stored dirty-components length (%s) to ' +
    'match dirty-components array length (%s).',
    len,
    dirtyComponents.length
  );


  dirtyComponents.sort(mountOrderComparator);

  for (var i = 0; i < len; i++) {
    
    var component = dirtyComponents[i]; // 获取类组件初始化实例

   
    var callbacks = component._pendingCallbacks;
    component._pendingCallbacks = null;

    var markerName;
    if (ReactFeatureFlags.logTopLevelRenders) {
      var namedComponent = component;
      
      if (
        component._currentElement.props ===
        component._renderedComponent._currentElement
      ) {
        namedComponent = component._renderedComponent;
      }
      markerName = 'React update: ' + namedComponent.getName();
      console.time(markerName);
    }

    ReactReconciler.performUpdateIfNecessary(
      component,
      transaction.reconcileTransaction
    );

    if (markerName) {
      console.timeEnd(markerName);
    }

    if (callbacks) {
      for (var j = 0; j < callbacks.length; j++) {
        transaction.callbackQueue.enqueue(
          callbacks[j],
          component.getPublicInstance()
        );
      }
    }
  }
}


/**
 *  进行更新操作
 *  该函数的this被改成ReactUpdates对象
 */
var flushBatchedUpdates = function() {
  
  // 循环判断队列数组中是否有值 或者 asapEnqueued属性为true
  while (dirtyComponents.length || asapEnqueued) {
    
    // 判断 数组中还有没有值
    if (dirtyComponents.length) {
      var transaction = ReactUpdatesFlushTransaction.getPooled(); // 更新事务
      transaction.perform(runBatchedUpdates, null, transaction); // 调用事务
      ReactUpdatesFlushTransaction.release(transaction);
    }

    if (asapEnqueued) {
      asapEnqueued = false;
      var queue = asapCallbackQueue;
      asapCallbackQueue = CallbackQueue.getPooled();
      queue.notifyAll();
      CallbackQueue.release(queue);
    }
  }
};

flushBatchedUpdates = ReactPerf.measure('ReactUpdates', 'flushBatchedUpdates', flushBatchedUpdates);

/**
 * 将组件标记为需要重新呈现，将可选回调添加到重发发生后将执行的函数列表。
 * @param {*} component 类组件初始化实例
 * @returns 
 */
function enqueueUpdate(component) {
  ensureInjected();


  // 判断是否不处于批量更新模式
  if (!batchingStrategy.isBatchingUpdates) {
    // 事务会执行该回调函数，并且将component参数传进来
    batchingStrategy.batchedUpdates(enqueueUpdate, component); 
    return;
  }

  // 如果处于批量更新中，则先将组件实例加到队列中
  dirtyComponents.push(component); // 组件实例加到数组中
}

/**
 * Enqueue a callback to be run at the end of the current batching cycle. Throws
 * if no updates are currently being performed.
 */
function asap(callback, context) {
  invariant(
    batchingStrategy.isBatchingUpdates,
    'ReactUpdates.asap: Can\'t enqueue an asap callback in a context where' +
    'updates are not being batched.'
  );
  asapCallbackQueue.enqueue(callback, context);
  asapEnqueued = true;
} 

var ReactUpdatesInjection = {

  injectReconcileTransaction: function(ReconcileTransaction) {
    invariant(
      ReconcileTransaction,
      'ReactUpdates: must provide a reconcile transaction class'
    );

    
    ReactUpdates.ReactReconcileTransaction = ReconcileTransaction;  //ReconcileTransaction为ReactReconcileTransaction模块的ReactReconcileTransaction函数
  },

  injectBatchingStrategy: function(_batchingStrategy) {
    invariant(
      _batchingStrategy,
      'ReactUpdates: must provide a batching strategy'
    );
    invariant(
      typeof _batchingStrategy.batchedUpdates === 'function',
      'ReactUpdates: must provide a batchedUpdates() function'
    );
    invariant(
      typeof _batchingStrategy.isBatchingUpdates === 'boolean',
      'ReactUpdates: must provide an isBatchingUpdates boolean attribute'
    );


    batchingStrategy = _batchingStrategy;
  },
};

var ReactUpdates = {
  /**
   * React references `ReactReconcileTransaction` using this property in order
   * to allow dependency injection.
   *
   * @internal
   */
  ReactReconcileTransaction: null,

  batchedUpdates: batchedUpdates,
  enqueueUpdate: enqueueUpdate,
  flushBatchedUpdates: flushBatchedUpdates,
  injection: ReactUpdatesInjection,   
  asap: asap,
};

module.exports = ReactUpdates;
