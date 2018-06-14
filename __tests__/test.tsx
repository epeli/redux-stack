import React from "react";
import {Provider} from "react-redux";

import {createThunks} from "../src/create-thunks";
import {createSimpleActions} from "../src/create-simple-actions";
import {configureStore} from "../src/configure-store";

const wait = (t: number) => new Promise(r => setTimeout(r, t));

test("can create reducers", () => {
    const initialState = {foo: "bar"};

    const SimpleActions = createSimpleActions(initialState, {
        setFoo(state, action: {foo: string}) {
            return {...state, foo: action.foo};
        },
    });

    const store = configureStore({
        reducer: SimpleActions.reducer,
    });

    store.dispatch(SimpleActions.creators.setFoo({foo: "next"}));

    expect(store.getState()).toEqual({foo: "next"});
});

test("reducers use immer", () => {
    const initialState = {nest: {foo: "initial"}};

    const SimpleActions = createSimpleActions(initialState, {
        setFoo(state, action: {foo: string}) {
            state.nest.foo = action.foo;
            return state;
        },
    });

    const store = configureStore({
        reducer: SimpleActions.reducer,
    });

    store.dispatch(SimpleActions.creators.setFoo({foo: "next"}));

    // no mutation
    expect(initialState.nest.foo).toEqual("initial");

    // state is updated
    expect(store.getState()).toEqual({nest: {foo: "next"}});
});

test("can call other reducers", () => {
    const initialState = {foo: "bar"};

    const SimpleActions = createSimpleActions(initialState, {
        setFoo(state, action: {foo: string}) {
            return this.setBar(state, {bar: action.foo});
        },

        setBar(state, action: {bar: string}) {
            return {...state, foo: action.bar + "BAR"};
        },
    });

    const store = configureStore({
        reducer: SimpleActions.reducer,
    });

    store.dispatch(SimpleActions.creators.setFoo({foo: "next"}));

    expect(store.getState()).toEqual({foo: "nextBAR"});
});

test("thunks work", () => {
    const initialState = {foo: "bar"};

    const SimpleActions = createSimpleActions(initialState, {
        setFoo(state, action: {foo: string}) {
            return {...state, foo: action.foo};
        },
    });

    const Thunks = createThunks(SimpleActions)({
        myThunk(boo: number) {
            return async dispatch => {
                // assert return value here too
                // const res: Promise<void> | void = dispatch(
                //     SimpleActions.creators.setFoo({foo: "from thunk"}),
                // );
                const res: Promise<void> | void = dispatch.setFoo({
                    foo: "from thunk",
                });
            };
        },
    });

    const store = configureStore({
        reducer: SimpleActions.reducer,
    });

    store.dispatch(Thunks.myThunk(3) as any);

    expect(store.getState()).toEqual({foo: "from thunk"});
});

test("thunks can call other thunks", async () => {
    const initialState = {foo: "bar"};
    const thunkSpy = jest.fn();

    const SimpleActions = createSimpleActions(initialState, {
        setFoo(state, action: {foo: string}) {
            return {...state, foo: action.foo};
        },
    });

    const Thunks = createThunks(SimpleActions)({
        myThunk(boo: number) {
            return async (dispatch, getState) => {
                dispatch(SimpleActions.creators.setFoo({foo: "first"}));
                thunkSpy();
                await dispatch(this.slowThunk());
            };
        },

        slowThunk() {
            return async dispatch => {
                await wait(50);
                thunkSpy();
                dispatch(SimpleActions.creators.setFoo({foo: "slow"}));
            };
        },
    });

    const store = configureStore({
        reducer: SimpleActions.reducer,
    });
    store.dispatch(Thunks.myThunk(3));

    expect(thunkSpy).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual({foo: "first"});

    await wait(100);

    expect(thunkSpy).toHaveBeenCalledTimes(2);
    expect(store.getState()).toEqual({foo: "slow"});
});

test("can assing store to provider (types)", () => {
    const store = configureStore({
        reducer: s => "sdf",
    });

    const app = (
        <Provider store={store}>
            <div />
        </Provider>
    );
});

test("can compose multiple reducers", () => {
    const initialState = {
        foo: "",
        bar: "",
    };

    const reducerSpy1 = jest.fn();
    const reducerSpy2 = jest.fn();

    const reducer1 = (
        state: typeof initialState,
        action: any,
    ): typeof initialState => {
        reducerSpy1();
        return {...state, foo: "reducer1"};
    };

    const reducer2 = (
        state: typeof initialState,
        action: any,
    ): typeof initialState => {
        reducerSpy2();
        return {...state, bar: "reducer2"};
    };

    const store = configureStore({
        reducers: [reducer1, reducer2],
        preloadedState: initialState,
    });

    expect(reducerSpy1).toHaveBeenCalledTimes(1);
    expect(reducerSpy2).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual({bar: "reducer2", foo: "reducer1"});
});
