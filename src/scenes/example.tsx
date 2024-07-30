import {initial, Line, LineProps, makeScene2D, Rect, RectProps, signal, Txt, View2D} from '@motion-canvas/2d';
import {all, createRefArray, noop, Origin, Random, SignalValue, SimpleSignal, ThreadGenerator, useRandom, waitFor} from '@motion-canvas/core';
import chroma from 'chroma-js';

const BAR_NUM = 10;
const MIN_BAR_HEIGHT = 30;
const MAX_BAR_HEIGHT = 300;
const BAR_WIDTH = 50;
const BAR_SPACING = 10;
const HUE_RANGE = 300; // NOTE: to rotate hues the other way flip the sign
const HUE_START = 30;
const PAIRS_BEFORE_BULK = 5;
const LAYER_OFFSET = BAR_WIDTH / 2;

const BAR_HUE_INCREASE = HUE_RANGE / BAR_NUM;

const SEPARATE_LAYER_OF_2 = true;
const TRANSPARIFY_SEARCH_RANGE_ENDS = false;

export default makeScene2D(function* (view) {
	const random = useRandom(2);

	view.offset([0.3, -0.05]);

	const pmerge_me = new PMergeMeAnimator(view, random);
	yield* waitFor(0.75);
	yield* pmerge_me.shuffle();
	yield* pmerge_me.sort();
});

interface Slice<T> extends Array<T> {
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

function createSlice<T>(arr: T[], from: number = 0, to: number = arr.length): Slice<T> {
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

class PMergeMeAnimator {
	private root_layer: PMergeMeAnimatorLayer;

	constructor(private view: View2D, private random: Random) {
		const bars = createRefArray<Bar>();
		
		for (let i = 0; i < BAR_NUM; i++) {
			// const height = MIN_BAR_HEIGHT + BAR_HEIGHT_INCREASE * i;
			this.view.add(<Bar
				ref={bars}
				index={i}
				value={i}
				// x={BAR_X_INCREASE * i} y={-height / 2}
				// width={BAR_WIDTH} height={height}
				// fill={{l: 0.7, c: 0.16, h: HUE_START + BAR_HUE_INCREASE * i} as any}
				// color={chroma.oklch(0.7, 0.16, HUE_START + BAR_HUE_INCREASE * i)}
				color={new OkLCH(
					0.7,
					0.16,
					HUE_START + BAR_HUE_INCREASE * i
				)}
			/>);
		}

		this.root_layer = new PMergeMeAnimatorLayer(this.view, this.random, createSlice([...bars]));
	}

	*shuffle() {
		yield* this.root_layer.shuffle();
	}

	*sort() {
		yield* this.root_layer.sort();
	}
}

class JacobsthalSequence {
	private power_of_2: number;
	private n: number;

	/**
	 * @param [start_value=2] First value in the sequence (use 1 for index sequence, use 2 for the groupsize sequence)
	 */
	constructor(start_value: number = 2) {
		this.power_of_2 = start_value;
		this.n = 0;
	}

	next() {
		this.n = this.power_of_2 - this.n;
		this.power_of_2 *= 2;
		return this.n;
	}
}

interface PairComponentProps extends Omit<LineProps, 'points'> {
	left_bar: SignalValue<Bar>,
	right_bar: SignalValue<Bar>,
}

class PairComponent extends Line {
	@signal()
	public declare readonly left_bar: SimpleSignal<Bar>;

	@signal()
	public declare readonly right_bar: SimpleSignal<Bar>;

	constructor(props?: PairComponentProps) {
		const y = () => -Math.min(this.left_bar().size.y(), this.right_bar().size.y()) / 2;
		super({
			points: () => [
				[this.left_bar().position.x(), y()],
				[this.right_bar().position.x(), y()]
			],
			...props
		});
	}
}

interface BarProps extends Omit<RectProps, 'position' | 'size' | 'x' | 'width' | 'height' | 'fill'> {
	value: SignalValue<number>,
	index: SignalValue<number>,
	layerOffset?: SignalValue<number>,
	color: SignalValue<OkLCH>;
}

class OkLCH {
	constructor(public lightness: number, public chroma: number, public hue: number, public alpha: number = 1) {
	}

	brighten(v: number = 1) {
		return new OkLCH(
			this.lightness * (1 + v * 0.2),
			this.chroma,
			this.hue,
			this.alpha,
		);
	}

	darken(v: number = 1) {
		return new OkLCH(
			this.lightness / (1 + v * 0.2),
			this.chroma,
			this.hue,
			this.alpha,
		);
	}

	saturate(v: number = 1) {
		return new OkLCH(
			this.lightness,
			this.chroma * (1 + v * 0.2),
			this.hue,
			this.alpha,
		);
	}

	desaturate(v: number = 1) {
		return new OkLCH(
			this.lightness,
			this.chroma / (1 + v * 0.2),
			this.hue,
			this.alpha,
		);
	}
}

class Bar extends Rect {
	@signal()
	public declare readonly value: SimpleSignal<number, this>;

	@signal()
	public declare readonly index: SimpleSignal<number, this>;

	@initial(0)
	@signal()
	public declare readonly layerOffset: SimpleSignal<number, this>;

	@signal()
	public declare readonly color: SimpleSignal<OkLCH, this>;

	constructor(props?: BarProps) {
		const height = () => this.value() * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) / BAR_NUM + MIN_BAR_HEIGHT;
		super({
			width: BAR_WIDTH,
			height: () => height(),

			x: () => this.index() * (BAR_WIDTH + BAR_SPACING) + this.layerOffset() * LAYER_OFFSET,
			offsetY: 1,

			fill: () => chroma.oklch(this.color().lightness, this.color().chroma, this.color().hue, this.color().alpha ?? 1),

			...props
		});
		const fontSize = 20;
		this.add(<Txt text={() => this.value().toFixed(0)} fill={'#EEE'} fontSize={fontSize} y={() => -this.getOriginDelta(Origin.Middle).y + fontSize} />)
	}

	static cmp(a: Bar, b: Bar) {
		return basic_cmp(a.value(), b.value());
	}
}

class PMergeMeAnimatorLayer {
	private pair_num: number;
	private pair_gap: number;
	private has_loner: boolean;
	private pairs: Slice<PairComponent>;
	private layer: number;

	constructor(private view: View2D, private random: Random, private bars: Slice<Bar>, private parent: null | PMergeMeAnimatorLayer = null) {
		this.pair_num = Math.floor(bars.length / 2);
		this.pair_gap = Math.ceil(bars.length / 2);
		this.has_loner = bars.length % 2 == 1;
		this.layer = (this.parent?.layer ?? -1) + 1;
	}

	*shuffle() {
		for (let len = this.bars.length; len > 0; len--) {
			const i = this.random.nextInt(0, len);
			this.bars.move(i, this.bars.length - 1);
		}

		yield* all(...this.bars.map((bar, i) => bar.index(i, 0.75)));
	}

	*sort() {
		yield* this.createPairs();
		yield* this.sortPairs();
		yield* this.recurse();
		yield* this.insertion();
	}

	*createPairs() {
		const pairs = createRefArray<PairComponent>();
		for (let i = 0; i < this.pair_num; i++) {
			this.view.add(<PairComponent
				ref={pairs}
				left_bar={this.bars[i]}
				right_bar={this.bars[i + this.pair_gap]}
				stroke={'white'}
				lineWidth={0}
			/>);
		}
		this.pairs = createSlice([...pairs]);
		yield* all(...this.pairs.map(line => line.lineWidth(2, 0.75)));
		if (this.has_loner) {
			const loner = this.bars[this.pair_num];
			yield* all(
				loner.stroke('#f24f4f', 0.5),
				loner.lineWidth(3, 0.5),
			);
		}
	}

	swapped(index_a: number, index_b: number, anims: ThreadGenerator[]) {
		this.swap(index_a, index_b, anims);
		this.parent?.swapped(index_a + this.pair_gap, index_b + this.pair_gap, anims);
	}

	swap(index_a: number, index_b: number, anims: ThreadGenerator[] = []) {
		this.bars.swap(index_a, index_b);

		anims.push(
			this.bars[index_a].index(this.bars.offset() + index_a, 2),
			this.bars[index_b].index(this.bars.offset() + index_b, 2),
		);

		this.parent?.swapped(index_a, index_b, anims);
		return anims;
	}

	moved(from: number, to: number, anims: ThreadGenerator[]) {
		this.move(from, to, anims);
		this.parent?.moved(from + this.pair_gap, to + this.pair_gap, anims);
	}

	move(from: number, to: number, anims: ThreadGenerator[] = []) {
		this.bars.move(from, to);
		for (let i = from; i <= to; i++) {
			anims.push(this.bars[i].index(this.bars.offset() + i, 2));
		}
		this.parent?.moved(from, to, anims);
		return anims;
	}

	getPair(bar_index: number) {
		const real_bar_index = bar_index + this.bars.offset();
		return this.pairs.find((pair) => pair.left_bar().index() === real_bar_index || pair.right_bar().index() === real_bar_index);
	}

	*sortPairs() {
		const UNSORTED_PAIR_COLOR = '#f24f4f';
		const   SORTED_PAIR_COLOR = 'lightgreen';

		let i = 0;
		for (; i < PAIRS_BEFORE_BULK && i < this.pair_num; i++) {
			const left = this.bars[i];
			const right = this.bars[i + this.pair_gap];
			const previousPair = i > 0 ? this.getPair(i - 1) : null;
			const pair = this.getPair(i);
			if (left.size.y() > right.size.y()) {
				yield* all(
					pair.stroke(UNSORTED_PAIR_COLOR, 0.75),
					previousPair?.stroke('white', 0.75) ?? noop()
				);
				// TODO: highlight pair blocks

				const anims = this.swap(i, i + this.pair_gap);

				yield* all(
					...anims,
					pair.stroke(SORTED_PAIR_COLOR, 2)
				); // TODO: maybe make a swapping pair happen in the foreground
			}
			else {
				yield* all(
					pair.stroke(SORTED_PAIR_COLOR, 1.25),
					previousPair?.stroke('white', 1.25) ?? noop()
				);
			}
		}
		const previousPair = i > 0 ? this.getPair(i - 1) : null;
		yield* all(previousPair?.stroke('white', 0.75) ?? noop());

		const anims: ThreadGenerator[] = [];
		for (let i = PAIRS_BEFORE_BULK; i < this.pair_num; i++) {
			const left = this.bars[i];
			const right = this.bars[i + this.pair_gap];
			if (left.size.y() > right.size.y()) {
				const swap_anims = this.swap(i, i + this.pair_gap);
				anims.push(...swap_anims);
			}
		}
		yield* all(...anims);
	}

	*recurse(): ThreadGenerator {
		// TODO: create little gap and grey out old layers (stack?)
		const sub_bars = this.bars.slice(this.pair_gap);
		const bars_behind = this.bars.slice(0, this.pair_gap);
		if (sub_bars.length >= 2) {
			yield* all(
				...sub_bars.map((bar) => bar.layerOffset(bar.layerOffset() + 1, 1)),
				...bars_behind.map((bar) => bar.color(bar.color().darken(1.5).desaturate(3), 1)),
				...this.pairs.map((pair) => pair.stroke('gray', 1)),
			);

			const child = new PMergeMeAnimatorLayer(this.view, this.random, sub_bars, this);
			yield* child.sort();

			yield* all(
				// ...sub_bars.map((bar) => bar.layerOffset(bar.layerOffset() - 1, 1)),
				...bars_behind.map((bar) => bar.color(bar.color().brighten(1.5).saturate(3), 1)),
				...this.pairs.map((pair) => pair.stroke('white', 1)),
			);
		}
		else if (this.has_loner || SEPARATE_LAYER_OF_2) {
			yield* all(
				...sub_bars.map((bar) => bar.layerOffset(bar.layerOffset() + 1, 1)),
			);
		}
	}

	*insertion() {
		if (!SEPARATE_LAYER_OF_2 && this.pair_gap === 1) {
			return;
		}
		let to_sort = this.pair_gap;
		if (to_sort >= 1) {
			const bar = this.bars[0];
			const pair = this.getPair(0);
			yield* all(bar.layerOffset(bar.layerOffset() + 1, 2), ...this.move(0, this.pair_gap - 1), pair.lineWidth(0, 2));
			to_sort--;
		}
		const left_over = this.has_loner ? 1 : 0;
		const jacob = new JacobsthalSequence();
		while (to_sort > left_over) {
			const group_size = Math.min(jacob.next(), to_sort - left_over);
			const unsorted_after_group = to_sort - left_over - group_size;
			let search_size = this.bars.length - to_sort - unsorted_after_group - 1; // TODO: check for off-by-one error
			for (let i = group_size - 1; i >= 0; i--) {
				const bar = this.bars[i];
				const search_range = this.bars.slice(to_sort, to_sort + search_size);
				if (TRANSPARIFY_SEARCH_RANGE_ENDS) {
					yield* all(
						...this.bars.map((bar) => bar.opacity(1, 1)),
						search_range[0].opacity(0.5, 2),
						search_range[search_range.length - 1].opacity(0.5, 2)
					);
				}
				const insertion_index = binarySearch(search_range, bar, Bar.cmp);
				const pair = this.getPair(i);
				if (insertion_index === search_range.length - 1) {
					search_size--;
				}
				yield* all(bar.layerOffset(bar.layerOffset() + 1, 2), ...this.move(i, to_sort + insertion_index - 1), pair.lineWidth(0, 2));
				to_sort--;
			}
		}
		if (this.has_loner) {
			const loner = this.bars[0];
			const search_range = this.bars.slice(to_sort);

			if (TRANSPARIFY_SEARCH_RANGE_ENDS) {
				yield* all(
					...this.bars.map((bar) => bar.opacity(1, 1)),
					search_range[0].opacity(0.5, 2),
					search_range[search_range.length - 1].opacity(0.5, 2)
				);
			}

			const insertion_index = binarySearch(search_range, loner, Bar.cmp);
			// NOTE: the loner, by definition, does not have a pair
			yield* all(loner.lineWidth(0, 2), loner.layerOffset(loner.layerOffset() + 1, 2), ...this.move(0, to_sort + insertion_index - 1));
			to_sort--;
		}
		yield *all(...this.bars.map((bar) => all(bar.layerOffset(bar.layerOffset() - 1, 1), bar.opacity(1, 1))));
	}
}

enum Eq {
	LESS,
	EQUAL,
	GREAT,
}

function basic_cmp<T>(a: T, b: T) {
	if (a === b) {
		return Eq.EQUAL;
	}
	if (a < b) {
		return Eq.LESS;
	}
	return Eq.GREAT;
}

function binarySearch<T>(arr: Slice<T>, value: T, cmp: (a: T, b: T) => Eq = basic_cmp<T>) {
	let start = 0;
	let end = arr.length;
	while (start != end) {
		const mid = Math.floor((start + end) / 2);
		const eq = cmp(arr[mid], value);
		if (eq == Eq.EQUAL) {
			return mid + 1;
		}
		if (eq === Eq.GREAT) {
			end = mid;
		}
		else {
			start = mid + 1;
		}
	}
	return end;
}

/*
	search for: 2

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	 s             m               e

	1 =?= 2 => LESS

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                 s     m       e
	
	2 =?= 2 => EQUAL

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                         s m   e
	
	4 =?= 2 => GREAT

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                         s e
							 m
	
	2 =?= 2 => EQUAL

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                           s
							   e
							   m



	search for: 3

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	 s             m               e

	1 =?= 3 => LESS

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                 s     m       e
	
	2 =?= 3 => LESS

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                         s m   e
	
	4 =?= 3 => GREAT

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                         s e
							 m
	
	2 =?= 3 => LESS

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                           s
							   e
							   m



	search for: 1

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	 s             m               e

	1 =?= 1 => EQUAL

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                 s     m       e
	
	2 =?= 1 => GREAT

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                 s m   e
	
	2 =?= 1 => GREAT

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                 s e
					 m
	
	1 =?= 1 => EQUAL

	[0 0 0 0 1 1 1 1 1 2 2 2 2 4 4]
	                   s
					   e
					   m
*/

function shuffle<T>(arr: T[], random: Random) {
	for (let len = arr.length; len > 0; len--) {
		const i = random.nextInt(0, len);
		const item = arr[i];
		arr.splice(i, 1);
		arr.push(item);
	}
}

