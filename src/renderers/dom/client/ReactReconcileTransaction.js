/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactReconcileTransaction
 */

'use strict';

var CallbackQueue = require('CallbackQueue');
var PooledClass = require('PooledClass');
var ReactBrowserEventEmitter = require('ReactBrowserEventEmitter');
var ReactInputSelection = require('ReactInputSelection');
var Transaction = require('Transaction');


/**
 * Ensures that, when possible, the selection range (currently selected text
 * input) is not disturbed by performing the transaction.
 */
var SELECTION_RESTORATION = {
  /**
   * @return {Selection} Selection information.
   */
  initialize: ReactInputSelection.getSelectionInformation,
  
  /**
   * @param {Selection} sel Selection information returned from `initialize`.
   */
  close: ReactInputSelection.restoreSelection,
};

/**
 * Suppresses events (blur/focus) that could be inadvertently dispatched due to
 * high level DOM manipulations (like temporarily removing a text input from the
 * DOM).
 */
var EVENT_SUPPRESSION = {
  /**
   * @return {boolean} The enabled status of `ReactBrowserEventEmitter` before
   * the reconciliation.
   */
  initialize: function() {
    var currentlyEnabled = ReactBrowserEventEmitter.isEnabled();
    ReactBrowserEventEmitter.setEnabled(false);
    return currentlyEnabled;
  },

  /**
   * @param {boolean} previouslyEnabled Enabled status of
   *   `ReactBrowserEventEmitter` before the reconciliation occurred. `close`
   *   restores the previous value.
   */
  close: function(previouslyEnabled) {
    ReactBrowserEventEmitter.setEnabled(previouslyEnabled);
  },
};

/**
 * Provides a queue for collecting `componentDidMount` and
 * `componentDidUpdate` callbacks during the transaction.
 */
var ON_DOM_READY_QUEUEING = {
  /**
   * Initializes the internal `onDOMReady` queue.
   */
  initialize: function() {
    this.reactMountReady.reset();
  },

  /**
   * After DOM is flushed, invoke all registered `onDOMReady` callbacks.
   */
  close: function() {
    this.reactMountReady.notifyAll();
  },
};

/**
 * Executed within the scope of the `Transaction` instance. Consider these as
 * being member methods, but with an implied ordering while being isolated from
 * each other.
 */
var TRANSACTION_WRAPPERS = [
  SELECTION_RESTORATION,
  EVENT_SUPPRESSION,
  ON_DOM_READY_QUEUEING,
];



/**
 * 
 * @param {Boolean} useCreateElement  ?????????
 */
function ReactReconcileTransaction(useCreateElement) {

  this.reinitializeTransaction();  // ??????????????????????????????reinitializeTransaction??????

  this.renderToStaticMarkup = false;
  this.reactMountReady = CallbackQueue.getPooled(null); // ?????????????????????CallbackQueue??????
  /* 
     ??????????????????
      _callbacks???null
      _contexts???null
  
  */


  this.useCreateElement = useCreateElement;
}

var Mixin = {
  /**
   * @see Transaction
   * @abstract
   * @final
   * @return {array<object>} List of operation wrap procedures.
   *   TODO: convert to array<TransactionWrapper>
   */
  getTransactionWrappers: function() {
    return TRANSACTION_WRAPPERS; // ??????????????????????????????
  },

  /**
   * @return {object} The queue to collect `onDOMReady` callbacks with.
   */
  getReactMountReady: function() {
    return this.reactMountReady;
  },

  /**
   * Save current transaction state -- if the return value from this method is
   * passed to `rollback`, the transaction will be reset to that state.
   */
  checkpoint: function() {
    // reactMountReady is the our only stateful wrapper
    return this.reactMountReady.checkpoint();
  },

  rollback: function(checkpoint) {
    this.reactMountReady.rollback(checkpoint);
  },

  /**
   * `PooledClass` looks for this, and will invoke this before allowing this
   * instance to be reused.
   */
  destructor: function() {
    CallbackQueue.release(this.reactMountReady);
    this.reactMountReady = null;
  },
};

// ???ReactReconcileTransaction???????????????????????????
Object.assign(ReactReconcileTransaction.prototype, Transaction.Mixin, Mixin);



/* 
    ???ReactReconcileTransaction???????????????????????????????????????
    ?????????????????????????????????????????????????????????
    instancePool????????????
    getPooled???PooledClass?????????oneArgumentPooler??????
    poolSize???10
    release???PooledClass?????????standardReleaser??????
*/
PooledClass.addPoolingTo(ReactReconcileTransaction); // ??????????????????????????????

module.exports = ReactReconcileTransaction;
