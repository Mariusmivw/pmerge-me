export enum Eq {
	LESS,
	EQUAL,
	GREAT,
}

export type CmpFn<T> = (a: T, b: T) => Eq;

export function basic_cmp<T>(a: T, b: T) {
	if (a === b) {
		return Eq.EQUAL;
	}
	if (a < b) {
		return Eq.LESS;
	}
	return Eq.GREAT;
}

export function inverse<T>(cmp: CmpFn<T>) {
	return (a: T, b: T) => {
		const r = cmp(a, b);
		if (r === Eq.EQUAL) {
			return Eq.EQUAL;
		}
		if (r === Eq.LESS) {
			return Eq.GREAT;
		}
		return Eq.LESS;
	}
}


