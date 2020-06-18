export class State<T> {
	#lastValue: T;
	#listeners: { [key: string]: ValueSubscription<T> } = {};

	constructor(defaultValue: T) {
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

	dispose() {
		for (const listener in this.#listeners) {
			this.removeListener(this.#listeners[listener]);
		}
	}
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

function id() {
	return Math.random().toString(36).substr(2, 6);
}
