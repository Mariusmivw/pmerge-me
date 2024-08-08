export interface Slice<T> extends Array<T> {
	slice(from: number, to?: number): Slice<T>;
	splice(from: number, deleteCount?: number, ...items: T[]): Slice<T>;
	map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[];
	move(from: number, to: number): void;
	swap(index_a: number, index_b: number): void;
	get length(): number;
	toArray(): T[];

	offset(): number;
	arr(): T[];
}

export function createSlice<T>(arr: T[], from: number = 0, to: number = arr.length): Slice<T> {
	const this_from = from;
	const this_to = to;
	return new Proxy({
		slice(from: number, to: number = this.length) {
			return createSlice(arr, this_from + from, this_from + to);
		},
		splice(start: number, deleteCount: number = 0, ...items: T[]) {
			arr.splice(this_from + start, deleteCount, ...items);
		},
		map(...args) {
			return arr.slice(this_from, this_to).map(...args);
		},
		move(from: number, to: number) {
			const [value] = arr.splice(this_from + from, 1);
			arr.splice(this_from + to, 0, value);
		},
		swap(index_a: number, index_b: number) {
			const tmp = arr[this_from + index_a];
			arr[this_from + index_a] = arr[this_from + index_b];
			arr[this_from + index_b] = tmp;
		},
		get length() {
			return this_to - this_from;
		},
		set length(v) {
			arr.length = v;
		},
		get find() {
			return arr.slice(this_from, this_to).find;
		},
		toArray() {
			return arr.slice(this_from, this_to);
		},

		offset() {
			return this_from;
		},
		arr() {
			return arr;
		}
	} as Slice<T>, {
		get(target, p) {
			if (p in target) {
				return Reflect.get(target, p);
			}
			if (typeof p === 'string') {
				if ([...p].every((c) => '0' <= c && c <= '9')) {
					return Reflect.get(arr, this_from + parseInt(p));
				}
			}
			return Reflect.get(target, p);
		},
		set(target, p, new_value) {
			if (p in target) {
				return Reflect.set(target, p, new_value);
			}
			if (typeof p === 'string') {
				if ([...p].every((c) => '0' <= c && c <= '9')) {
					return Reflect.set(arr, this_from + parseInt(p), new_value);
				}
			}
			return Reflect.set(target, p, new_value);
		}
	})
}


