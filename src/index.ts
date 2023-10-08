import mp from 'miniprogram-render';
import React from "react";
import ReactDOM from 'react-dom';
import resolve, { registerToGlobleScope } from 'kbs-dsl-resolver';

const {
  createElement,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} = React;

// 动态挂载 React
registerToGlobleScope({
  React,
  /** react 相关接口 */
  // 渲染函数
  createElement,
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useCallback
});

const config = {
	"optimization": {
		"domSubTreeLevel": 10,
		"elementMultiplexing": true,
		"textMultiplexing": true,
		"commentMultiplexing": true,
		"domExtendMultiplexing": true,
		"styleValueReduce": 5000,
		"attrValueReduce": 5000
	},
  "runtime": {
		"subpackagesMap": {},
		"tabBarMap": {},
		"usingComponents": {}
	},
};

Component({
  properties: {
    dslJson: {
      type: Object,
      value: undefined,
    },
    props: {
      type: Object,
      value: undefined,
    }
  },
  data: { pageId: '' },
  attached() {
    const mpRender = mp.createPage('kbone-smart', config);
    const { document, window } = mpRender;
    // @ts-ignore
    ReactDOM.init(window);
    const container = document.createElement('view');
    document.body.appendChild(container);
    Object.assign(this, {
      mpRender,
      container,
      // 表示挂载成功
      hasAttached: true,
    });
  },
  detached() {
    // 销毁
    // @ts-ignore
    if (this.mpRender) {
      // @ts-ignore
      this.mpRender.document.body.$$recycle(); // 回收 dom 节点
      // @ts-ignore
      this.mpRender.window.$$destroy();
    }
    // @ts-ignore
    mp.destroyPage(this.pageId);
  },
  methods: {
    // 执行渲染
    render() {
      // commonjs 标准
      const MyComponent = resolve(this.properties.dslJson).default;
      ReactDOM.render(
        createElement(MyComponent, this.properties.props, null),
        // @ts-ignore
        this.container
      );
      // @ts-ignore
      this.setData({ pageId: this.mpRender.pageId });
    },
  },
  // 监听
  observers: {
    'dslJson, props'() {
      // @ts-ignore
      if (this.hasAttached) {
        this.render();
      }
    }
  }
});
