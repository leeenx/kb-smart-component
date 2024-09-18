import mp from 'miniprogram-render';
import React from "react";
import ReactDOM from 'react-dom';
//@ts-ignore
import resolve, { registerToGlobleScope, registerToScope } from 'kbs-dsl-resolver';
//@ts-ignore
import load, { watch } from 'kbs-dsl-loader';
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
  enableCache?: boolean;
  cacheName?: string;
  cacheTime?: number;
  cacheMaxSize?: number;
  pageName?: string;
  pageId?: string;
}

const { createElement } = React;

/**
 * 通过 Object.keys 来劫持 miniprogram-element
 */
const events = [
  'scroll',
  'chooseavatar',
  'getuserinfo',
  'contact',
  'getphonenumber',
  'getrealtimephonenumber',
  'opensetting',
  'launchapp',
  'agreeprivacyauthorization',
  'scrolltoupper',
  'scrolltolower',
  'refresherpulling',
  'refresherrefresh',
  'refresherrestore',
  'refresherabort',
  'activeend',
  'statuschange',
  'ready',
  'confirm',
  'keyboardheightchange',
  'nicknamereview',
  'columnchange',
  'pickstart',
  'pickend',
  'changing',
  'linechange',
  'success',
  'fail',
  'complete',
  'ended',
  'imeupdate',
  'stop',
  'initdone',
  'scancode',
  'statechange',
  'fullscreenchange',
  'netstatus',
  'audiovolumenotify',
  'enterpictureinpicture',
  'leavepictureinpicture',
  'castinguserselect',
  'castingstatechange',
  'castinginterrupt',
  'bgmstart',
  'bgmprogress',
  'bgmcomplete',
  'waiting',
  'progress',
  'loadedmetadata',
  'controlstoggle',
  'seekcomplete',
  'tap',
  'markertap',
  'labeltap',
  'controltap',
  'callouttap',
  'updated',
  'regionchange',
  'poitap',
  'polylinetap',
  'abilitysuccess',
  'abilityfailed',
  'authsuccess',
  'interpolatepoint',
  'longtap',
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
            // 加到 detail 中
            evt.detail && Object.assign(evt.detail, { eventName: type });
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
  if (
    (
      typeof component === 'string' &&
      (
        component === 'button' ||
        component.indexOf('wx-') === 0
      )
    ) &&
    props
  ) {
    const eventHandlers: { eventName: string; propKey: string; handler: any }[] = [];
    keys(props).forEach(propKey => {
      const eventName = propKey.replace(/^on/, '').toLowerCase();
      if (events.includes(eventName)) {
        // 存放到 eventHandlers
        eventHandlers.push({
          eventName,
          propKey,
          handler: props[propKey]
        })
        // 不支持的事件，直接删除(其实也可以保留)
        delete props[propKey];
      }
    });
    props.onScroll = function(evt: any) {
      eventHandlers.some(({ eventName, propKey, handler }) => {
        if (evt?.detail?.eventName === eventName) {
          Object.assign(evt, {
            type: eventName,
            _reactName: propKey
          })
          evt.nativeEvent && Object.assign(evt.nativeEvent, {
            $_name: eventName
          });
          handler.call(this, evt);
          return true;
        }
        return false;
      });
    };
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
      // this.mpRender.document.body.$$recycle(); // 回收 dom 节点 ---- 如果开启会有BUG
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
      const { nameSpace, enableCache } = this.properties.props;
      // commonjs 标准
      const resolvedModule = resolve(dslJson, nameSpace, enableCache, hotUpdating);
      const pageName = this.properties.props.pageName || 'default';
      const MyComponent = resolvedModule[pageName];
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
        nameSpace,
        pageName,
        pageId,
        watchOptions,
        enableCache,
        cacheName,
        cacheTime,
        cacheMaxSize,
      } = this.properties.props as Props;
      if (!dslJson) {
        try {
          dslJson = await load(url, enableCache, cacheName, cacheTime, cacheMaxSize);
          if (watchOptions) {
            watch({
              ...watchOptions,
              update: (newDslJson) => {
                this.update(newDslJson, true);
              }
            });
          }
        } catch {
          this.triggerEvent('error');
        }
      }
      this.update(dslJson);
      this.setData({
        // @ts-ignore
        pageId: this.mpRender.pageId,
        nameSpace,
        wxPageName: pageName,
        wxPageId: pageId
      });

      // @ts-ignore
      this.triggerEvent('load');
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
      const nameSpace = this.properties.props?.nameSpace;
      if (nameSpace) {
        registerToScope(nameSpace, {
          getThisPointer: () => this.selectComponent('.miniprogram-element')
        });
      }
      // @ts-ignore
      if (this.hasAttached) {
        this.render();
      }
    }
  }
});
