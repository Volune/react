/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment node
 */

/* eslint-disable no-func-assign */

'use strict';

let React;
let ReactFeatureFlags;
let ReactNoop;
let useState;
let useMemo;
let useRef;
let useImperativeMethods;
let forwardRef;
let inScope;
let inNamedScopes;
let inConditionalScope;

// These tests use React Noop Renderer. All new tests should use React Test
// Renderer and go in ReactHooks-test; plan is gradually migrate the noop tests
// to that file.
describe('ReactHooksScopes', () => {
  beforeEach(() => {
    jest.resetModules();

    jest.mock('scheduler', () => {
      let scheduledCallbacks = new Map();

      return {
        unstable_scheduleCallback(callback) {
          const handle = {};
          scheduledCallbacks.set(handle, callback);
          return handle;
        },
        unstable_cancelCallback(handle) {
          scheduledCallbacks.delete(handle);
        },
      };
    });

    ReactFeatureFlags = require('shared/ReactFeatureFlags');
    ReactFeatureFlags.debugRenderPhaseSideEffectsForStrictMode = false;
    ReactFeatureFlags.enableHooks = true;
    ReactFeatureFlags.enableSchedulerTracing = true;
    React = require('react');
    ReactNoop = require('react-noop-renderer');
    useState = React.useState;
    useMemo = React.useMemo;
    useRef = React.useRef;
    useImperativeMethods = React.useImperativeMethods;
    forwardRef = React.forwardRef;
    inScope = React.inScope;
    inNamedScopes = React.inNamedScopes;
    inConditionalScope = React.inConditionalScope;
  });

  function span(prop) {
    return {type: 'span', hidden: false, children: [], prop};
  }

  function Text(props) {
    ReactNoop.yield(props.text);
    return <span prop={props.text} />;
  }

  describe('inScope', () => {
    it('simple mount and update', () => {
      function Counter(props, ref) {
        return inScope(() => {
          const [count, updateCount] = useState(0);
          useImperativeMethods(ref, () => ({updateCount}));
          return <Text text={'Count: ' + count} />;
        });
      }
      Counter = forwardRef(Counter);
      const counter = React.createRef(null);
      ReactNoop.render(<Counter ref={counter} />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);

      counter.current.updateCount(1);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
    });
  });

  describe('updates during the render phase', () => {
    it('restarts the render function and applies the new updates on top', () => {
      function ScrollView({row: newRow}) {
        let externalCounter = useRef(0);
        externalCounter.current += 1;

        let internalCounter = 0;
        inScope(() => {
          internalCounter = useRef(0);
          internalCounter.current += 1;
          let [row, setRow] = useState(1);

          if (row !== newRow) {
            // Row changed since last render. Update state from props
            setRow(newRow);
          }
        });

        return <Text text={`Counters: ${externalCounter.current} ${internalCounter.current}`} />;
      }

      ReactNoop.render(<ScrollView row={1} />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Counters: 1 1')]);

      ReactNoop.render(<ScrollView row={5} />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Counters: 2 3')]);

      ReactNoop.render(<ScrollView row={5} />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Counters: 3 4')]);

      ReactNoop.render(<ScrollView row={10} />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Counters: 4 6')]);

      ReactNoop.render(<ScrollView row={10} />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Counters: 5 7')]);
    });
  });

  describe('inNamedScopes', () => {
    it('simple mount and update', () => {
      let factor = 2;
      function List(props, ref) {
        // The test assumes the items in list are unique
        const [list, setList] = useState([1]);
        useImperativeMethods(ref, () => ({setList}));
        const multipliedList = inNamedScopes(inNamedScope =>
          list.map(item => {
            return inNamedScope(item, () => {
              return useMemo(() => item * factor, [item]);
            });
          })
        );
        return <Text text={'List: ' + multipliedList.join(',')} />;
      }
      List = forwardRef(List);
      const counter = React.createRef(null);
      ReactNoop.render(<List ref={counter} />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('List: 2')]);

      counter.current.setList([1, 2]);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('List: 2,4')]);

      counter.current.setList([1, 3, 2]);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('List: 2,6,4')]);

      factor = 5;
      counter.current.setList([1, 4, 3, 2]);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('List: 2,20,6,4')]);
    });
  });

  describe('inConditionalScope', () => {
    it('simple mount and update', () => {
      function Component() {
        return inConditionalScope(true, () => {
          return <Text text={'Text'} />;
        });
      }
      ReactNoop.render(<Component />);
      ReactNoop.flush();
      expect(ReactNoop.getChildren()).toEqual([span('Text')]);
    });
  });

});
