// @ts-ignore
import * as R from 'ramda';
import Customize, { userDefineFns } from './customize';

export interface DslJson {
  type: 'literal' | 'call-function' | 'customize-function' | 'component',
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
  if (R.is(Object, dslJson)) {
    customize = customize || new Customize();
    const { type, isAsync, name = '', value, params = [], body = [] } = dslJson as DslJson;
    switch(type) {
      case 'literal':
        // 字面量，仍然需要进行解析
        if (R.is(Array, value)) {
          return value.map((item: any) => dslResolve(item, customize));
        } else if (R.is(Object, value)) {
          const obj: any = {};
          Object.entries(value).forEach(([key, value]) => {
            obj[key] = dslResolve(value as any, customize);
          });
          return obj;
        }
        return value;
      // 调用函数
      case 'call-function': {
        const functionParams: any[] = (Array.isArray(value) ? value : [value]).map(item => dslResolve(item, customize));
        if (customize[name as keyof Customize]) {
          // 优先从「customize」找
          return customize[name as keyof Customize]?.(...functionParams);
        } else if (userDefineFns[name]) {
          // 其次从「userDefineFns」找
          return userDefineFns[name]?.(...functionParams);
        } else if (R.hasOwnProperty(name)) {
          // 兜底使用「RamdaJs」
          return R[name]?.(...functionParams);
        } else {
          throw new Error(`未定义的 call-function: ${name}`);
        }
      }
      // 创建函数
      case 'customize-function':
      // 创建组件
      case 'component':
        return customize.createFunction(isAsync, params, body);
      default:
        // 转换成 literal
        if (!R.is(Function, dslJson) && (R.is(Array, dslJson) || R.is(Object, dslJson))) {
          const result: any = dslResolve({ type: 'literal', value: dslJson }, customize);
          return result;
        }
        return dslJson as string;
    }
  }
  return dslJson as string;
}

export default dslResolve;
