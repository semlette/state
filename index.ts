export class State<T> {
	#lastValue: T;
	#defaultValue: T;
	#listeners: { [key: string]: ValueSubscription<T> } = {};

	constructor(defaultValue: T) {
		this.#defaultValue = defaultValue;
		this.#lastValue = defaultValue;
	}

	addListener(subscription: ValueSubscription<T>) {
		this.#listeners[subscription.id] = subscription;
		subscription.callback(this.#lastValue);
	}

	removeListener(subscription: ValueSubscription<T>) {
		delete this.#listeners[subscription.id];
	}

	setValue(value: T) {
		this.#lastValue = value;
		for (const listener in this.#listeners) {
			this.#listeners[listener].callback(value);
		}
	}

	valueOf(): T {
		return this.#lastValue;
	}

	get defaultValue(): T {
		return this.#defaultValue;
	}

	dispose() {
		for (const listener in this.#listeners) {
			this.removeListener(this.#listeners[listener]);
		}
	}
}

export abstract class StringableState<T> extends State<T> {
	abstract marshalString(value: T): string;
	abstract unmarshalString(string: string): T;
}

export type ValueCallback<T> = (value: T) => void;

export class ValueSubscription<T> {
	state: State<T>;

	constructor(
		public id: string,
		listenable: State<T>,
		public callback: ValueCallback<T>,
	) {
		this.state = listenable;
	}

	dispose() {
		this.state.removeListener(this);
	}
}

export function valueOf<T>(
	state: State<T>,
	callback: ValueCallback<T>,
): ValueSubscription<T> {
	const subscription = new ValueSubscription(id(), state, callback);
	state.addListener(subscription);
	callback(state.valueOf());
	return subscription;
}

export function valueForFocusable<T>(
	state: State<T>,
	focusable: HTMLElement,
	callback: ValueCallback<T>,
) {
	const preventingCallback: ValueCallback<T> = (value: T) => {
		if (document.activeElement != focusable) {
			callback(value);
		}
	};
	const subscription = new ValueSubscription(id(), state, preventingCallback);
	if (document.activeElement != focusable) {
		callback(state.valueOf());
	}
	state.addListener(subscription);
	return subscription;
}

export function eventListener<T>(
	state: State<T>,
	validator?: StateUpdateValidator<T>,
	property = "value",
): EventListener {
	return (event) => {
		const newValue = (<any>event.target)[property];
		if (validator) {
			const ok = validator(newValue);
			if (!ok) {
				event.preventDefault();
				(<any>event.target)[property] = state.valueOf();
				return;
			}
		}
		state.setValue(newValue);
	};
}

export type StateUpdateValidator<T> = (newValue: T) => boolean;

export function persistStateToURLArgument<T>(
	state: StringableState<T>,
	argumentName: string,
): ValueSubscription<T> {
	const params = new URLSearchParams(window.location.search);
	const param = params.get(argumentName);

	if (param !== null) {
		if (param !== state.marshalString(state.defaultValue)) {
			state.setValue(state.unmarshalString(param));
		}
	}

	function callback(value: T) {
		const params = new URLSearchParams(window.location.search);
		const param = params.get(argumentName);
		if (param !== null) {
			compareAndSetURLArgument(
				params,
				argumentName,
				param,
				state.marshalString(value),
			);
		} else {
			if (state.valueOf() !== state.defaultValue) {
				setURLArgument(
					params,
					argumentName,
					state.marshalString(state.valueOf()),
				);
			}
		}
	}
	const subscription = new ValueSubscription(id(), state, callback);
	state.addListener(subscription);
	return subscription;
}

function compareAndSetURLArgument(
	reuseableParams: URLSearchParams,
	argumentName: string,
	paramValue: string,
	stringValue: string,
) {
	if (paramValue !== stringValue) {
		setURLArgument(reuseableParams, argumentName, stringValue);
	}
}

function setURLArgument(
	reuseableParams: URLSearchParams,
	argumentName: string,
	value: string,
) {
	reuseableParams.set(argumentName, value);
	const newURL = window.location.pathname + "?" + reuseableParams.toString();
	window.history.replaceState(null, "", newURL);
}

function id() {
	return Math.random().toString(36).substr(2, 6);
}
