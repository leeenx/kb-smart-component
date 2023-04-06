import mp from 'miniprogram-render';
import { createElement } from 'react';
import ReactDOM from 'react-dom';
import dslResolve from './utils/dsl-resolver';

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
    if (this.mpRender) {
        this.mpRender.document.body.$$recycle(); // 回收 dom 节点
        this.mpRender.window.$$destroy();
    }
    mp.destroyPage(this.pageId);
  },
  methods: {
    // 执行渲染
    render() {
      const MyComponent = dslResolve(this.properties.dslJson);
      ReactDOM.render(
        createElement(MyComponent, this.properties.props, null),
        this.container
      );
      this.setData({ pageId: this.mpRender.pageId });
    },
  },
  // 监听
  observers: {
    'dslJson, props'(dslJson, props) {
      if (this.hasAttached) {
        this.render();
      }
    }
  }
});
