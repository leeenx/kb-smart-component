# kb-smart-component

基于 kbone 的异步加载组件的渲染器。本组件不是通过「javascript解释器」实现异步加载，而通过 DSL 实现组件的异步加载。

# 原理解析

「待补全」


# DSL

自定义函数

```javascript
{
  type: 'customize-function',
  name: 'myFunction',
  isAsync: true,
  params: ['a', 'b'],
  body: [
    {
      type: 'call-function',
      name: 'const',
      value: ['c', { type: 'literal', value: 100 }]
    },
    {
      type: 'call-function',
      name: 'const',
      value: ['d', { type: 'literal', value: 120 }]
    },
    {
      type: 'call-function',
      name: 'const',
      value: ['e', {
        type: 'call-function',
        name: 'sum',
        value: [
          {
            type: 'literal',
            value: [
              {
                type: 'call-function',
                name: 'getConst',
                value: { type: 'literal', value: 'a' }
              },
              {
                type: 'call-function',
                name: 'getConst',
                value: { type: 'literal', value: 'b' }
              },
              {
                type: 'call-function',
                name: 'getConst',
                value: { type: 'literal', value: 'c' }
              },
              {
                type: 'call-function',
                name: 'getConst',
                value: { type: 'literal', value: 'd' }
              }
            ]
          }
        ]
      }]
    },
    {
      type: 'call-function',
      name: 'constAwait',
      isAwait: true,
      value: ['fetchRes', {
        type: 'call-function',
        name: 'fetch',
        value: [],
      },],
    },
    {
      type: 'call-function',
      name: 'console.log',
      value: [{
        type: 'call-function',
        name: 'getConst',
        value: {
          type: 'literal',
          value: 'fetchRes'
        }
      }]
    },
    {
      type: 'call-function',
      name: 'return',
      value: [
        {
          type: 'literal',
          value: {
            a: {
              type: 'call-function',
              name: 'getConst',
              value: 'a'
            },
            b: {
              type: 'call-function',
              name: 'getConst',
              value: 'b'
            },
            c: {
              type: 'call-function',
              name: 'getConst',
              value: 'c'
            },
            d: {
              type: 'call-function',
              name: 'getConst',
              value: 'd'
            },
            e: {
              type: 'call-function',
              name: 'getConst',
              value: 'e'
            }
          }
        }
      ]
    }
  ]
}

```

组件

```javascript
const MyComponent = dslResolve({
  type: 'customize-function',
  name: 'MyComponent',
  params: ['props'],
  body: [
    {
      type: 'call-function',
      name: 'const',
      value: [
        'nameState',
        {
          type: 'call-function',
          name: 'useState',
          value: '初始名'
        }
      ]
    },
    {
      type: 'call-function',
      name: 'const',
      value: [
        'name',
        {
          type: 'call-function',
          name: 'view',
          value: [
            {
              type: 'call-function',
              name: 'lensIndex',
              value: [
                0,
                {
                  type: 'call-function',
                  name: 'getConst',
                  value: 'nameState'
                }
              ]
            },
            {
              type: 'call-function',
              name: 'getConst',
              value: 'nameState'
            }
          ]
        }
      ]
    },
    {
      type: 'call-function',
      name: 'const',
      value: [
        'setName',
        {
          type: 'call-function',
          name: 'view',
          value: [
            {
              type: 'call-function',
              name: 'lensIndex',
              value: [
                1,
                {
                  type: 'call-function',
                  name: 'getConst',
                  value: 'nameState'
                }
              ]
            },
            {
              type: 'call-function',
              name: 'getConst',
              value: 'nameState'
            }
          ]
        }
      ]
    },
    {
      type: 'call-function',
      name: 'console.log',
      value: [
        '>>>>>>',
        {
          type: 'call-function',
          name: 'getConst',
          value: 'name'
        }
      ]
    },
    {
      type: 'call-function',
      name: 'const',
      value: [
        'handleClick',
        {
          type: 'call-function',
          name: 'useCallback',
          value: [
            {
              type: 'customize-function',
              params: [],
              body: [
                {
                  type: 'call-function',
                  name: 'console.log',
                  value: {
                    type: 'call-function',
                    name: 'getConst',
                    value: 'name'
                  }
                },
                {
                  type: 'call-function',
                  name: 'ifElse',
                  value: [
                    {
                      type: 'call-function',
                      name: 'equals',
                      value: [
                        '初始名',
                        {
                          type: 'call-function',
                          name: 'getConst',
                          value: 'name'
                        }
                      ]
                    },
                    {
                      type: 'customize-function',
                      body: [
                        {
                          type: 'call-function',
                          name: 'call',
                          value: [
                            {
                              type: 'call-function',
                              name: 'getConst',
                              value: 'setName',
                            },
                            '不是初始名'
                          ]
                        }
                      ]
                    },
                    {
                      type: 'customize-function',
                      body: [
                        {
                          type: 'call-function',
                          name: 'call',
                          value: [
                            {
                              type: 'call-function',
                              name: 'getConst',
                              value: 'setName',
                            },
                            '初始名'
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              type: 'literal',
              value: [
                {
                  type: 'call-function',
                  name: 'getConst',
                  value: 'name'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'call-function',
      name: 'console.log',
      value: {
        type: 'call-function',
        name: 'getConst',
        value: 'handleClick'
      }
    },
    {
      type: 'call-function',
      name: 'return',
      value: {
        type: 'call-function',
        name: 'createElement',
        value: [
          'div',
          {
            type: 'literal',
            value: {
              style: { color: 'red' },
              onClick: {
                type: 'call-function',
                name: 'getConst',
                value: 'handleClick'
              }
            }
          },
          {
            type: 'call-function',
            name: 'getConst',
            value: 'name'
          }
        ]
      }
    }
  ]
});

```

