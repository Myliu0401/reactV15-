/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultInjection
 */

'use strict';

var BeforeInputEventPlugin = require('BeforeInputEventPlugin');
var ChangeEventPlugin = require('ChangeEventPlugin');
var DefaultEventPluginOrder = require('DefaultEventPluginOrder');
var EnterLeaveEventPlugin = require('EnterLeaveEventPlugin');
var ExecutionEnvironment = require('ExecutionEnvironment');
var HTMLDOMPropertyConfig = require('HTMLDOMPropertyConfig');
var ReactComponentBrowserEnvironment =
  require('ReactComponentBrowserEnvironment');
var ReactDOMComponent = require('ReactDOMComponent');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactDOMEmptyComponent = require('ReactDOMEmptyComponent');
var ReactDOMTreeTraversal = require('ReactDOMTreeTraversal');
var ReactDOMTextComponent = require('ReactDOMTextComponent');
var ReactDefaultBatchingStrategy = require('ReactDefaultBatchingStrategy');
var ReactEventListener = require('ReactEventListener');
var ReactInjection = require('ReactInjection');
var ReactReconcileTransaction = require('ReactReconcileTransaction');
var SVGDOMPropertyConfig = require('SVGDOMPropertyConfig');
var SelectEventPlugin = require('SelectEventPlugin');
var SimpleEventPlugin = require('SimpleEventPlugin');

var alreadyInjected = false;

function inject() {
  if (alreadyInjected) {
    // TODO: This is currently true because these injections are shared between
    // the client and the server package. They should be built independently
    // and not share any injection state. Then this problem will be solved.
    return;
  }
  alreadyInjected = true;

  // 注入ReactEventListener
  ReactInjection.EventEmitter.injectReactEventListener(
    ReactEventListener
  );

  /**
   * 注入模块以解析DOM层次结构和插件顺序。
   */
  ReactInjection.EventPluginHub.injectEventPluginOrder(DefaultEventPluginOrder);
  ReactInjection.EventPluginUtils.injectComponentTree(ReactDOMComponentTree);
  ReactInjection.EventPluginUtils.injectTreeTraversal(ReactDOMTreeTraversal);

  /**
   * 默认包含一些重要的事件插件（无需要求它们）。
   */
  ReactInjection.EventPluginHub.injectEventPluginsByName({
    SimpleEventPlugin: SimpleEventPlugin,    // 简单事件插件
    EnterLeaveEventPlugin: EnterLeaveEventPlugin, // 进入离开事件插件
    ChangeEventPlugin: ChangeEventPlugin,  // 更改事件插件
    SelectEventPlugin: SelectEventPlugin,  // 选择事件插件 
    BeforeInputEventPlugin: BeforeInputEventPlugin, // 输入事件插件之前
  });

  ReactInjection.NativeComponent.injectGenericComponentClass(
    ReactDOMComponent
  );

  ReactInjection.NativeComponent.injectTextComponentClass(
    ReactDOMTextComponent
  );

  ReactInjection.DOMProperty.injectDOMPropertyConfig(HTMLDOMPropertyConfig);
  ReactInjection.DOMProperty.injectDOMPropertyConfig(SVGDOMPropertyConfig);

  ReactInjection.EmptyComponent.injectEmptyComponentFactory(
    function(instantiate) {
      return new ReactDOMEmptyComponent(instantiate);
    }
  );

  ReactInjection.Updates.injectReconcileTransaction(
    ReactReconcileTransaction
  );
  ReactInjection.Updates.injectBatchingStrategy(
    ReactDefaultBatchingStrategy
  );

  ReactInjection.Component.injectEnvironment(ReactComponentBrowserEnvironment);

  if (__DEV__) {
    var url = (ExecutionEnvironment.canUseDOM && window.location.href) || '';
    if ((/[?&]react_perf\b/).test(url)) {
      var ReactDefaultPerf = require('ReactDefaultPerf');
      ReactDefaultPerf.start();
    }
  }
}

module.exports = {
  inject: inject,
};
