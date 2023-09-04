import dslResolve from "./dsl-resolver";
import {
  createElement,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
// @ts-ignore
import * as R from 'ramda';
// type
import type { DslJson } from "./dsl-resolver";

// 自定义的方法
export default class Customize {
  constructor(parentGlobal?: any) {
    Object.defineProperty(this.global, '__parent__', {
      value: parentGlobal,
      writable: false,
    });
  }
  global: any = {};
  returnObject: { result: any } | null = null;
  // 常量
  const(key: string, value: any) {
    Object.defineProperty(this.global, key, {
      value,
      writable: false,
    });
    return value;
  }
  async constAwait (key: string, value: Promise<any>) {
    const asyncValue = await value;
    return this.const(key, asyncValue);
  }
  async letAwait (key: string, value: Promise<any>) {
    const asyncValue = await value;
    return this.let(key, asyncValue);
  }
  async varAwait (key: string, value: Promise<any>) {
    const asyncValue = await value;
    return this.var(key, asyncValue);
  }
  // let
  let(key: string, value: any) {
    Object.defineProperty(this.global, key, {
      value,
      writable: true,
    });
    return value;
  }
  // var
  var(key: string, value: any) {
    return this.let(key, value);
  }
  // 取值
  getConst(key: string) {
    let value:any = this.global[key];
    if (!this.global.hasOwnProperty(key)) {
      // 当前作用域找不到，往上找
      let parent = this.global.__parent__;
      while(Boolean(parent)) {
        if (parent.hasOwnProperty(key)) {
          value = parent[key];
          break;
        }
        parent = parent.__parent__;
      }
    }
    return value;
  }
  getLet(key: string) {
    return this.getConst(key);
  }
  getVar(key: string) {
    return this.getConst(key);
  }
  getFunction(key: string, params?: any[]) {
    const fun = this.getConst(key);
    return fun?.(params);
  }
  // 获取形参 ---- 等同于 getLet
  getArg(key: string) {
    return this.getLet(key);
  }
  // 赋值
  setLet(key: string, value?: any) {
    if (this.global.hasOwnProperty(key)) {
      this.global[key] = value;
    } else {
      // 当前作用域找不到，往上找
      let parent = this.global.__parent__;
      let hasSetValue = false;
      while(Boolean(parent)) {
        if (parent.hasOwnProperty(key)) {
          parent[key] = value;
          hasSetValue = true;
          break;
        }
        parent = parent.__parent__;
      }
      if (!hasSetValue) {
        throw Error(`未声明的变量: ${key}`);
      }
    }
  }
  // 返回值
  return(dslJson: DslJson) {
    // 标记已经返回
    this.returnObject = {
      result: dslResolve(dslJson)
    };
  }
  // 销毁
  destroy() {
    this.global = null;
  }
  // 删除
  delete(key: string, source: any = this.global) {
    delete source[key];
  }
  // 函数体的执行队列
  functionQueue(queue: DslJson[], customize: Customize) {
    // 检查 queue 里面有没有 isAsync
    return new Promise(resolve => {
      this.executeFunctionQueueItem(0, queue, customize, (result) => {
        resolve(result);
      });
    });
  }
  // 按顺序执行函数体
  executeFunctionQueueItem(
    index: number,
    queue: DslJson[],
    customize: Customize,
    final: (result?: any) => void,
  ) {
    const lastIndex = queue.length - 1;
    const item = queue[index];
    const res = dslResolve(item, customize);
    
    if (index >= lastIndex) {
      // 最后一条语句
      final();
    } else {
      const next = () => {
        if (this.returnObject) {
          // 表示有返回，中断上下文
          const result = this.returnObject?.result;
          this.returnObject = null;
          final(result);
        } else {
          this.executeFunctionQueueItem(index + 1, queue, customize, final);
        }
      };
      if (item.isAwait) {
        (res as Promise<any>).then(() => next());
      } else {
        next();
      }
    }
  }
  // 创建拟函数
  createFunction(isAsync: boolean = false, params: string[], body: DslJson[]) {
    const parentGlobal = this.global;
    const functionQueue = this.functionQueue.bind(this);
    return function() {
      const customize = new Customize(parentGlobal);
      const args = arguments;
      // 在函数上下文挂载 arguments
      customize.const('arguments', arguments);
      // 在函数上下文中挂载 this
      // @ts-ignore
      customize.const('this', this);
      params.forEach((name, index) => {
        // 形参用 let 不用 const
        customize.let(name!, args[index]);
      });
      if (isAsync) {
        // 使用 async 语法糖，需要做同步化特殊处理
        return functionQueue(body, customize);
      } else {
        // 直接返回
        body.some(item => {
          if (item.isAwait) {
            throw new Error('await必须在async函数中');
          }
          dslResolve(item, customize);
          if (customize.returnObject) {
            // 表示的返回
            return true;
          }
          return false;
        });
        const result = customize.returnObject?.result;
        customize.returnObject = null;
        if (typeof result !== 'undefined') {
          return result;
        }
      }
    };
  }
  // 打印函数
  'console.log'() {
    // @ts-ignore
    console.log(...arguments);
  }
  'console.info'() {
    // @ts-ignore
    console.info(...arguments);
  }
  'console.error'() {
    // @ts-ignore
    console.error(...arguments);
  }
  // ifElse 函数改造
  ifElse(condition: boolean, onTrue: Function, onFail: Function) {
    return R.ifElse((isTrue: boolean) => isTrue && condition, onTrue, onFail)(R.T);
  }
  // new RegExp
  getRegExp(pattern: string, modifiers: string) {
    return new RegExp(pattern, modifiers);
  }
  // new Class
  newClass(params: string[], body: DslJson[]) {
    // 模拟一个类
    const fakeClass = this.createFunction(false, params, body) as () => void;
    return new fakeClass();
  }
  /** react 相关接口 */
  // 渲染函数
  createElement = createElement;
  useState = useState;
  useEffect = useEffect;
  useMemo = useMemo;
  useLayoutEffect = useLayoutEffect;
  useRef = useRef;
  useCallback = useCallback;
  // 微信对象
  wx = wx;
  /**
   * 注册方法或成员，非全局性的。只在上下文生效，相当于 const 的别名
   */
  register(key: string, value: any) {
    this.const(key, value);
  }
}

// 用户自定义的方法
export const userDefineFns: Record<string, Function> = {};

/**
 * 提供给开发注册新方法的入口，通过此入口注册的方法是全局性的
 */
export const setUserDefineFns = (defineFns: Record<string, Function>) => {
  Object.assign(userDefineFns, defineFns);
};
