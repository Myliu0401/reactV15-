/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule setTextContent
 */

'use strict';

/**
 * ExecutionEnvironment模块的源码
 * @param {*} _dereq_ 
 * @param {*} module 
 * @param {*} exports 
 */
function myExecutionEnvironment(_dereq_, module, exports) {
      /**
       * Copyright (c) 2013-present, Facebook, Inc.
       * All rights reserved.
       *
       * This source code is licensed under the BSD-style license found in the
       * LICENSE file in the root directory of this source tree. An additional grant
       * of patent rights can be found in the PATENTS file in the same directory.
       *
       */

       'use strict';

       var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
 
       /**
        * Simple, lightweight module assisting with the detection and context of
        * Worker. Helps avoid circular dependencies and allows code to reason about
        * whether or not they are in a Worker, even if they never include the main
        * `ReactWorker` dependency.
        */
       var ExecutionEnvironment = {
 
         canUseDOM: canUseDOM,
 
         canUseWorkers: typeof Worker !== 'undefined',
 
         canUseEventListeners: canUseDOM && !!(window.addEventListener || window.attachEvent),
 
         canUseViewport: canUseDOM && !!window.screen,
 
         isInWorker: !canUseDOM // For now, this is true - might change in the future.
 
       };
 
       module.exports = ExecutionEnvironment;
}





var ExecutionEnvironment = require('ExecutionEnvironment');
var escapeTextContentForBrowser = require('escapeTextContentForBrowser');
var setInnerHTML = require('setInnerHTML');

/**
 * Set the textContent property of a node, ensuring that whitespace is preserved
 * even in IE8. innerText is a poor substitute for textContent and, among many
 * issues, inserts <br> instead of the literal newline chars. innerHTML behaves
 * as it should.
 *
 * @param {DOMElement} node 标签
 * @param {string} text 文本
 * @internal
 */
var setTextContent = function(node, text) {
  node.textContent = text;
};

if (ExecutionEnvironment.canUseDOM) {
  if (!('textContent' in document.documentElement)) {
    setTextContent = function(node, text) {
      setInnerHTML(node, escapeTextContentForBrowser(text));
    };
  }
}

module.exports = setTextContent;
