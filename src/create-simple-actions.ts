/**
 * Fork from https://github.com/wkrueger/redutser
 */

import produce from "immer";

export const _SIMPLE_ACTIONS_META = Symbol("_SIMPLE_ACTIONS_META");

export const _CREATED_WITH_SIMPLE_ACTIONS = Symbol(
    "_CREATED_WITH_SIMPLE_ACTIONS",
);

const DEFAULT_PREFIX = "SIMPLE_ACTION";

type SecondArg<T> = T extends (x: any, y: infer V) => any ? V : never;
type Values<K> = K[keyof K];

export interface SimpleActionsObject<State> {
    [name: string]: (
        this: SimpleActionsObject<State>,
        state: State,
        action: any,
    ) => State;
}

export interface SimpleActionsMeta<State, Actions> {
    [_SIMPLE_ACTIONS_META]: {
        initialState: State;
        actions: Actions;
        immer: boolean;
        prefix: string;
    };
}

export type ActionCreatorsFromSimpleActions<
    Actions extends SimpleActionsObject<any>
> = {
    [K in keyof Actions]: (
        payload: SecondArg<Actions[K]>,
    ) => {
        type: K;
        payload: SecondArg<Actions[K]>;

        // This makes it impossible to create actions objects manually
        [_CREATED_WITH_SIMPLE_ACTIONS]: true;
    }
};

export type ActionTypesFromSimpleActions<
    Inp extends SimpleActionsObject<any>
> = ReturnType<Values<ActionCreatorsFromSimpleActions<Inp>>>;

interface CreateSimpleActionsOptions {
    /**
     * Set to false to disable Immer usage
     * https://github.com/mweststrate/immer
     */
    immer?: boolean;

    /**
     * action type prefix
     */
    actionTypePrefix?: string;
}

function removePrefix(actionType: string) {
    return actionType
        .split(":")
        .slice(1)
        .join(":");
}

export const createSimpleActions = <
    State,
    Actions extends SimpleActionsObject<State>
>(
    initialState: State,
    actions: Actions,
    options?: CreateSimpleActionsOptions,
) => {
    const meta: SimpleActionsMeta<State, Actions> = {
        [_SIMPLE_ACTIONS_META]: {
            initialState,
            actions,
            prefix: options
                ? options.actionTypePrefix || DEFAULT_PREFIX
                : DEFAULT_PREFIX,
            immer: options ? Boolean(options.immer) : true,
        },
    };

    const creators = createActionCreators(meta[_SIMPLE_ACTIONS_META].prefix)(
        actions,
    );

    return Object.assign(creators, meta);
};

function createActionCreators(prefix: string) {
    return <D extends SimpleActionsObject<any>>(
        dict: D,
    ): ActionCreatorsFromSimpleActions<D> => {
        return Object.keys(dict).reduce(
            (out, name) => ({
                ...out,
                [name]: (i: any) => ({type: prefix + ":" + name, payload: i}),
            }),
            {},
        ) as any;
    };
}

interface CreateReducerOptions {}

/**
 * Create reducer function for Redux store
 *
 * @param actions actions object returned by createSimpleActions()
 */
export function createReducer<
    State,
    Actions extends SimpleActionsObject<State>
>(actions: SimpleActionsMeta<State, Actions>, options?: CreateReducerOptions) {
    const meta = actions[_SIMPLE_ACTIONS_META];

    return function reducer(
        state = meta.initialState,
        action: ActionTypesFromSimpleActions<Actions>,
    ): State {
        const type: string = action.type;

        if (!type.startsWith(meta.prefix + ":")) {
            return state;
        }

        const actionFn = meta.actions[removePrefix(type)];

        if (!actionFn) {
            return state;
        }

        if (meta.immer === false) {
            return actionFn.call(meta.actions, state, action.payload);
        }

        return produce(state, draftState => {
            return actionFn.call(meta.actions, draftState, action.payload);
        });
    };
}
