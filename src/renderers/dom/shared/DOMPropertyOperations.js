/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMPropertyOperations
 */

'use strict';

var DOMProperty = require('DOMProperty');
var ReactDOMInstrumentation = require('ReactDOMInstrumentation');
var ReactPerf = require('ReactPerf');

var quoteAttributeValueForBrowser = require('quoteAttributeValueForBrowser');
var warning = require('warning');

var VALID_ATTRIBUTE_NAME_REGEX = new RegExp(
  '^[' + DOMProperty.ATTRIBUTE_NAME_START_CHAR + '][' + DOMProperty.ATTRIBUTE_NAME_CHAR + ']*$'
);
var illegalAttributeNameCache = {};
var validatedAttributeNameCache = {};

function isAttributeNameSafe(attributeName) {
  if (validatedAttributeNameCache.hasOwnProperty(attributeName)) {
    return true;
  }
  if (illegalAttributeNameCache.hasOwnProperty(attributeName)) {
    return false;
  }
  if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName)) {
    validatedAttributeNameCache[attributeName] = true;
    return true;
  }
  illegalAttributeNameCache[attributeName] = true;
  warning(
    false,
    'Invalid attribute name: `%s`',
    attributeName
  );
  return false;
}

function shouldIgnoreValue(propertyInfo, value) {
  return value == null ||
    (propertyInfo.hasBooleanValue && !value) ||
    (propertyInfo.hasNumericValue && isNaN(value)) ||
    (propertyInfo.hasPositiveNumericValue && (value < 1)) ||
    (propertyInfo.hasOverloadedBooleanValue && value === false);
}

/**
 * Operations for dealing with DOM properties.
 */
var DOMPropertyOperations = {

  /**
   * Creates markup for the ID property.
   *
   * @param {string} id Unescaped ID.
   * @return {string} Markup string.
   */
  createMarkupForID: function(id) {
    return DOMProperty.ID_ATTRIBUTE_NAME + '=' +
      quoteAttributeValueForBrowser(id);
  },

  setAttributeForID: function(node, id) {
    node.setAttribute(DOMProperty.ID_ATTRIBUTE_NAME, id);
  },

  createMarkupForRoot: function() {
    return DOMProperty.ROOT_ATTRIBUTE_NAME + '=""';
  },

  // 给节点添加一个属性
  setAttributeForRoot: function(node) {
    node.setAttribute(DOMProperty.ROOT_ATTRIBUTE_NAME, '');   // 增加一个指定名称和治的新属性,第一个参数为name,第二个为value
  },

  /**
   * Creates markup for a property.
   *
   * @param {string} name
   * @param {*} value
   * @return {?string} Markup string, or null if the property was invalid.
   */
  createMarkupForProperty: function(name, value) {
    if (__DEV__) {
      ReactDOMInstrumentation.debugTool.onCreateMarkupForProperty(name, value);
    }
    var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ?
        DOMProperty.properties[name] : null;
    if (propertyInfo) {
      if (shouldIgnoreValue(propertyInfo, value)) {
        return '';
      }
      var attributeName = propertyInfo.attributeName;
      if (propertyInfo.hasBooleanValue ||
          (propertyInfo.hasOverloadedBooleanValue && value === true)) {
        return attributeName + '=""';
      }
      return attributeName + '=' + quoteAttributeValueForBrowser(value);
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        return '';
      }
      return name + '=' + quoteAttributeValueForBrowser(value);
    }
    return null;
  },

  /**
   * Creates markup for a custom property.
   *
   * @param {string} name
   * @param {*} value
   * @return {string} Markup string, or empty string if the property was invalid.
   */
  createMarkupForCustomAttribute: function(name, value) {
    if (!isAttributeNameSafe(name) || value == null) {
      return '';
    }
    return name + '=' + quoteAttributeValueForBrowser(value);
  },

  /**
   * 设置节点上特性的值。
   *
   * @param {DOMElement} node  dom节点
   * @param {string} name      属性名
   * @param {*} value          属性值
   */
  setValueForProperty: function(node, name, value) {
    if (__DEV__) {
      ReactDOMInstrumentation.debugTool.onSetValueForProperty(node, name, value);
    }
    var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ?
        DOMProperty.properties[name] : null;
    if (propertyInfo) {
      var mutationMethod = propertyInfo.mutationMethod;
      if (mutationMethod) {
        mutationMethod(node, value);
      } else if (shouldIgnoreValue(propertyInfo, value)) {
        this.deleteValueForProperty(node, name);
      } else if (propertyInfo.mustUseProperty) {
        var propName = propertyInfo.propertyName;
        // Must explicitly cast values for HAS_SIDE_EFFECTS-properties to the
        // property type before comparing; only `value` does and is string.
        if (!propertyInfo.hasSideEffects ||
            ('' + node[propName]) !== ('' + value)) {
          // Contrary to `setAttribute`, object properties are properly
          // `toString`ed by IE8/9.
          node[propName] = value;
        }
      } else {
        var attributeName = propertyInfo.attributeName;
        var namespace = propertyInfo.attributeNamespace;
        // `setAttribute` with objects becomes only `[object]` in IE8/9,
        // ('' + value) makes it output the correct toString()-value.
        if (namespace) {
          node.setAttributeNS(namespace, attributeName, '' + value);
        } else if (propertyInfo.hasBooleanValue ||
                   (propertyInfo.hasOverloadedBooleanValue && value === true)) {
          node.setAttribute(attributeName, '');
        } else {
          node.setAttribute(attributeName, '' + value);
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      DOMPropertyOperations.setValueForAttribute(node, name, value);
    }
  },

  setValueForAttribute: function(node, name, value) {
    if (!isAttributeNameSafe(name)) {
      return;
    }
    if (value == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, '' + value);
    }
  },

  /**
   * 删除节点上特性的值。
   *
   * @param {DOMElement} node    dom节点
   * @param {string} name        属性名
   */
  deleteValueForProperty: function(node, name) {
    if (__DEV__) {
      ReactDOMInstrumentation.debugTool.onDeleteValueForProperty(node, name);
    }

    // 判断存储库中是否有该属性，有就获取该属性
    var propertyInfo = DOMProperty.properties.hasOwnProperty(name) ? DOMProperty.properties[name] : null;

    // 判断该属性是否有值
    if (propertyInfo) {
      var mutationMethod = propertyInfo.mutationMethod;
      if (mutationMethod) {
        mutationMethod(node, undefined);
      } else if (propertyInfo.mustUseProperty) {
        var propName = propertyInfo.propertyName;
        if (propertyInfo.hasBooleanValue) {
          // No HAS_SIDE_EFFECTS logic here, only `value` has it and is string.
          node[propName] = false;
        } else {
          if (!propertyInfo.hasSideEffects ||
              ('' + node[propName]) !== '') {
            node[propName] = '';
          }
        }
      } else {
        node.removeAttribute(propertyInfo.attributeName); // 从dom中删除该属性
      }
    } else if (DOMProperty.isCustomAttribute(name)) { // 通过存储的正则看能不能配置得到该属性名
      node.removeAttribute(name); // 从dom中直接删除该属性
    }
  },

};

ReactPerf.measureMethods(DOMPropertyOperations, 'DOMPropertyOperations', {
  setValueForProperty: 'setValueForProperty',
  setValueForAttribute: 'setValueForAttribute',
  deleteValueForProperty: 'deleteValueForProperty',
});

module.exports = DOMPropertyOperations;
