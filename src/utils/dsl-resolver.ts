// @ts-ignore
import * as _ from 'lodash-es';
import Customize from './customize';

export interface DslJson {
  type: 'literal' | 'array-literal' | 'object-literal' | 'call-function' | 'customize-function' | 'component',
  name?: string;
  // 自定义函数形参
  params?: string[];
  // 组件的 props
  props?: Record<string, DslJson>;
  value?: any;
  body?: DslJson[];
  // 是否使用 async 语法糖
  isAsync?: boolean;
  // 使用 await 语句
  isAwait?: boolean;
}

const dslResolve = (dslJson: DslJson | string, customize?: Customize) => {
  // 变量的上下文也在这里
  if (_.isObject(dslJson)) {
    customize = customize || new Customize();
    const { type, name = '', value, params = [], body = [] } = dslJson as DslJson;
    switch(type) {
      /**
       * 直接调用内置解析函数
       * 当 name 为 callFun 时，才是逻辑上的调用函数
       */
      case 'call-function': {
        const paramsDsl: DslJson[] = Array.isArray(value) ? value : [value];
        const functionParams: any[] = paramsDsl;
        if (customize[name as keyof Customize]) {
          // 优先从「customize」找
          return customize[name as keyof Customize]?.(...functionParams);
        } else if (_.hasOwnProperty(name)) {
          // 兜底使用「RamdaJs」
          return _[name]?.(...functionParams);
        } else {
          throw new Error(`未定义的 call-function: ${name}`);
        }
      }
      // 创建函数
      case 'customize-function':
      // 创建组件
      case 'component':
        return customize.createFunction(params, body, name);
      case 'array-literal':
        return ([...value]).map((item: any) => dslResolve(item, customize));
      case 'object-literal': {
        const obj: any = {};
        value.forEach(({ key, value: valueDsl }) => {
          obj[key] = dslResolve(valueDsl, customize);
        });
        return obj;
      }
      // 普通字面量
      case 'literal':
        return value;
      default:
        // 直接返回
        return dslJson as any;
    }
  }
  return dslJson as string;
}

export default dslResolve;
