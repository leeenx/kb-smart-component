import mp from 'miniprogram-render';
import React from "react";
import ReactDOM from 'react-dom';
import resolve, { registerToGlobleScope } from 'kbs-dsl-resolver';
import dslLoad from 'kbs-dsl-loader';
import isEqual from 'lodash-es/isEqual';

interface WatchOptions {
  protocol?: 'ws';
  host?: string;
  port?: number;
  entry?: string;
}

interface Props {
  watch?: boolean;
  watchOptions?: WatchOptions;
  dslJson?: Object;
  url?: string;
  dslUrl?: string;
  nameSpace?: string;
}

const { createElement } = React;

/**
 * 通过 Object.keys 来劫持 miniprogram-element
 */
const events = [
  'chooseavatar',
  'getuserinfo'
];
const keys = Object.keys;
Object.keys = function(obj: Object) {
  if (obj['cover-image'] && obj['cover-image'].handles) {
    // 定位到 miniprogram-element/src/utl/component.js
    Object.values(obj).forEach(({ handles }) => {
      handles && keys(handles).forEach((key) => {
        const handle = handles[key];
        handles[key] = function(evt: any) {
          handle.call(this, evt);
          const { type } = evt;
          // 借道 scroll 事件
          if (events.includes(type)) {
            this.callSimpleEvent('scroll', evt);
          }
        }
      });
    });
    // 不再劫持
    Object.keys = keys;
  }
  return keys.call(this, obj);
};

function wxReactCreateElement(component, props, ...others) {
  if (component !== 'wx-scroll-view') {
    keys(props).forEach(propKey => {
      const eventName = propKey.replace(/^on/, '').toLowerCase();
      if (events.includes(eventName)) {
        // 替换 propKey
        props.onScroll = props[propKey];
        // 不支持的事件，直接删除(其实也可以保留)
        delete props[propKey];
      }
    });
  }
  // @ts-ignore
  return createElement.call(this, component, props, ...others);
};

// 动态挂载 React
registerToGlobleScope({
  React: {
    ...React,
    createElement: wxReactCreateElement
  }
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
    update(dslJson, hotUpdating = false) {
      // @ts-ignore
      const nameSpace = this.properties.props.nameSpace || this.pageId;
      // commonjs 标准
      const { default: MyComponent } = resolve(dslJson, nameSpace, hotUpdating);
      ReactDOM.render(
        createElement(MyComponent, null, null),
        // @ts-ignore
        this.container
      );
    },
    // 执行渲染
    async render() {
      let {
        dslJson,
        url,
        dslUrl,
        watch,
        watchOptions
      } = this.properties.props as Props;
      if (!dslJson) {
        dslJson = await dslLoad({
          url: url || dslUrl || '',
          fromHtml: Boolean(url),
          watch,
          watchOptions: {
            ...watchOptions,
            update: (newDslJson) => {
              this.update(newDslJson, true);
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
    'props'(props) {
      // @ts-ignore
      if (isEqual(this.prevProps, props)) {
        // 表示不需要更新
        return;
      }
      // @ts-ignore
      this.prevProps = props;
      // @ts-ignore
      if (this.hasAttached) {
        this.render();
      }
    }
  }
});
