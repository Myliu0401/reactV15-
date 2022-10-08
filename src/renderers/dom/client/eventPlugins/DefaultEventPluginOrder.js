/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DefaultEventPluginOrder
 */

'use strict';

var keyOf = require('keyOf');
/* 
源码
function (oneKeyObj) {
  var key;
  for (key in oneKeyObj) {
    if (!oneKeyObj.hasOwnProperty(key)) {
      continue;
    }
    return key;
  }
  return null;
};


*/




/**
 * 可注入到`EventPluginHub`中的模块，该模块指定`EventPlugin`s的确定性排序。
 * 一种方便的推理方式插件，而不必打包每个插件。
 * 这比让插件按照注入的顺序排序，因为该顺序将受到包装顺序的影响。
 * `ResponderEventPlugin`必须出现在`SimpleEventPlugin'之前，以便在“SimpleEventPlugin”处理程序中，防止默认事件非常便。
 */
var DefaultEventPluginOrder = [
  keyOf({ResponderEventPlugin: null}),
  keyOf({SimpleEventPlugin: null}),
  keyOf({TapEventPlugin: null}),
  keyOf({EnterLeaveEventPlugin: null}),
  keyOf({ChangeEventPlugin: null}),
  keyOf({SelectEventPlugin: null}),
  keyOf({BeforeInputEventPlugin: null}),
];

/*  DefaultEventPluginOrder = ['ResponderEventPlugin', 'SimpleEventPlugin', 'TapEventPlugin', 'EnterLeaveEventPlugin', 'ChangeEventPlugin', 'SelectEventPlugin', 'BeforeInputEventPlugin']  */

module.exports = DefaultEventPluginOrder;
