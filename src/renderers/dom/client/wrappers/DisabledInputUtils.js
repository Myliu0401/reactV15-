/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DisabledInputUtils
 */

'use strict';

var disableableMouseListenerNames = {
  onClick: true,
  onDoubleClick: true,
  onMouseDown: true,
  onMouseMove: true,
  onMouseUp: true,

  onClickCapture: true,
  onDoubleClickCapture: true,
  onMouseDownCapture: true,
  onMouseMoveCapture: true,
  onMouseUpCapture: true,
};

/**
 * Implements a native component that does not receive mouse events
 * when `disabled` is set.
 * inst参数为 组件初始化的实例
 * props参数为  props组件的props属性
 */
var DisabledInputUtils = {
  getNativeProps: function(inst, props) {
    
    // 判断是否不是禁用
    if (!props.disabled) {
      return props;
    }

    // 复制道具，鼠标侦听器除外
    var nativeProps = {};
    for (var key in props) {

      
      if (!disableableMouseListenerNames[key] && props.hasOwnProperty(key)) {
        nativeProps[key] = props[key]; // 复制除事件以外的属性
      }
    }

    return nativeProps;
  },
};

module.exports = DisabledInputUtils;
