import mp from 'miniprogram-render';
import React from "react";
import ReactDOM from 'react-dom';
import resolve, { registerToGlobleScope } from 'kbs-dsl-resolver';
import dslLoad from 'kbs-dsl-loader';

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
    watch: {
      type: Boolean,
      value: false
    },
    dslJson: {
      type: Object
    },
    url: {
      type: String
    },
    dslUrl: {
      type: String
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
    // 刷新组件
    update(dslJson) {
      // commonjs 标准
      const MyComponent = resolve(dslJson).default;
      ReactDOM.render(
        createElement(MyComponent, this.properties.props, null),
        // @ts-ignore
        this.container
      );
    },
    // 执行渲染
    async render() {
      let dslJson = this.properties.dslJson;
      if (!dslJson) {
        dslJson = await dslLoad({
          url: this.properties.url || this.properties.dslUrl || '',
          fromHtml: Boolean(this.properties.url),
          watch: this.properties.watch,
          watchOptions: {
            update: (dslJson) => {
              this.update(dslJson)
            }
          }
        });
      }
      this.update(dslJson);
      // @ts-ignore
      this.setData({ pageId: this.mpRender.pageId });
    },
  },
  // 监听
  observers: {
    'dslJson, url, dslUrl, props'() {
      // @ts-ignore
      if (this.hasAttached) {
        this.render();
      }
    }
  }
});
