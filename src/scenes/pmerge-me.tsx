import {Layout, makeScene2D, Node, Rect, Txt, View2D} from '@motion-canvas/2d';
import {all, createRef, createRefArray, createSignal, noop, Random, ThreadGenerator, useRandom, waitFor} from '@motion-canvas/core';
import Bar from './Bar';
import { basic_cmp, CmpFn, Eq } from './cmp';
import { createSlice, Slice } from './Slice';
import { OkLCH } from './utils';
import PairComponent from './PairComponent';
import SearchRange from './SearchRange';
import { AnimatedJacobsthalSequence } from './JacobsthalSequence';

export const BAR_NUM = 10;
export const MIN_BAR_HEIGHT = 30;
export const MAX_BAR_HEIGHT = 300;
export const BAR_WIDTH = 50;
export const BAR_SPACING = 10;
export const HUE_RANGE = 300; // NOTE: to rotate hues the other way flip the sign
export const HUE_START = 30;
export const PAIRS_BEFORE_BULK = 5;
export const LAYER_OFFSET = BAR_WIDTH / 2;
export const SEARCH_RANGE_HEIGHT = 40;

export const BAR_HUE_INCREASE = HUE_RANGE / BAR_NUM;

export const SEPARATE_LAYER_OF_2 = true;

export default makeScene2D(function* (view) {
	const random = useRandom(2);

	const pmerge_me = new PMergeMeAnimator(view, random);
	yield* waitFor(0.75);
	yield* pmerge_me.shuffle();

	// yield* pmerge_me.use_order([0, 1, 2]);
	// yield* pmerge_me.use_order([0, 2, 1]);
	// yield* pmerge_me.use_order([1, 0, 2]);
	// yield* pmerge_me.use_order([1, 2, 0]);
	// yield* pmerge_me.use_order([2, 0, 1]);
	// yield* pmerge_me.use_order([2, 1, 0]);

	// yield* pmerge_me.use_order([3, 2, 4, 0, 1, 7, 6, 5, 8, 9]);
	// yield* pmerge_me.use_order([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
	yield* pmerge_me.sort();
	console.log('final comparison count:', pmerge_me.get_cmp_count());
});

class PMergeMeAnimator {
	private root_layer: PMergeMeAnimatorLayer;
	private cmp_count: () => number;

	constructor(private view: View2D, private random: Random, order: number[] = null) {
		const bars = createRefArray<Bar>();
	
		const rect = <Rect position={[-(BAR_WIDTH + BAR_SPACING) * (BAR_NUM - 1) / 2, 100]} />
		
		for (let i = 0; i < BAR_NUM; i++) {
			// const height = MIN_BAR_HEIGHT + BAR_HEIGHT_INCREASE * i;
			rect.add(<Bar
				ref={bars}
				index={i}
				// value={i === 11 ? 15.5 : i}
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
		this.view.add(rect);

		const [cmp, cmp_count] = count_cmp(Bar.cmp);
		this.cmp_count = cmp_count;

		// NOTE: comparison count
		// rect.add(<Txt text={() => cmp_count().toString()}></Txt>);

		this.root_layer = new PMergeMeAnimatorLayer(rect, this.random, createSlice([...bars]), cmp);
		if (order !== null) {
			this.root_layer.set_order(order);
		}
	}

	get_cmp_count() {
		return this.cmp_count();
	}

	*shuffle() {
		yield* this.root_layer.shuffle();
	}

	*use_order(order: number[]) {
		yield* this.root_layer.set_order(order);
	}

	*sort() {
		yield* this.root_layer.sort();
	}
}

class PMergeMeAnimatorLayer {
	private pair_num: number;
	private pair_gap: number;
	private has_loner: boolean;
	private pairs: Slice<PairComponent>;
	private layer: number;
	private range: SearchRange;
	private jacob: AnimatedJacobsthalSequence;

	constructor(private container: Node, private random: Random, private bars: Slice<Bar>, private cmp: CmpFn<Bar>, private parent: null | PMergeMeAnimatorLayer = null) {
		this.pair_num = Math.floor(bars.length / 2);
		this.pair_gap = Math.ceil(bars.length / 2);
		this.has_loner = bars.length % 2 == 1;
		this.layer = (this.parent?.layer ?? -1) + 1;
		const range = createRef<SearchRange>();
		this.container.add(<SearchRange ref={range} layer={this.layer} left_bar={bars[0]} right_bar={bars[0]} />);
		this.range = range();
		const jacob_container = createRef<Layout>();
		this.container.add(<Layout ref={jacob_container} y={-450} x={100}/>);
		this.jacob = new AnimatedJacobsthalSequence(jacob_container());
	}

	*shuffle() {
		for (let len = this.bars.length; len > 0; len--) {
			const i = this.random.nextInt(0, len);
			this.bars.move(i, this.bars.length - 1);
		}

		yield* all(...this.bars.map((bar, i) => bar.index(i, 0.75)));
	}

	*set_order(order: number[]) {
		if (order.length !== this.bars.length) {
			throw new RangeError();
		}
		const sorted = order.slice().sort();
		if (sorted[0] !== 0) {
			throw new RangeError();
		}
		for (let i = 0; i < order.length - 1; i++) {
			if (sorted[i] !== sorted[i + 1] - 1) {
				throw new RangeError();
			}
		}

		for (let i = 0; i < order.length; i++) {
			const original_index = order[i];
			let index = original_index;
			for (let j = 0; j < i; j++) {
				if (original_index > order[j]) {
					index--;
				}
			}
			this.bars.move(index, this.bars.length - 1);
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
			this.container.add(<PairComponent
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
			if (this.cmp(left, right) === Eq.GREAT) {
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
			if (this.cmp(left, right) === Eq.GREAT) {
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

			const child = new PMergeMeAnimatorLayer(this.container, this.random, sub_bars, this.cmp, this);
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
		this.range.left_bar(this.bars[0]);
		this.range.right_bar(this.bars[0]);
		const left_over = this.has_loner ? 1 : 0;
		this.jacob.reset();
		const group_rect = createRef<Rect>();
		this.container.add(<Rect
			ref={group_rect}
			zIndex={-1}
			fill={'#252'}
			offset={[-1, 1]}
			x={-(BAR_WIDTH + BAR_SPACING) / 2 + (BAR_WIDTH + BAR_SPACING) * this.bars.offset() + LAYER_OFFSET * this.layer}
			y={BAR_SPACING / 2}
			width={0}
			height={MAX_BAR_HEIGHT + BAR_SPACING}
		/>);
		while (to_sort > left_over) {
			yield* this.jacob.animate_next();
			const next_jacob = this.jacob.next();
			const group_size = Math.min(next_jacob, to_sort - left_over);

			yield* group_rect().width((BAR_WIDTH + BAR_SPACING) * group_size, 2);

			const unsorted_after_group = to_sort - left_over - group_size;
			let search_size = this.bars.length - to_sort - unsorted_after_group - 1;
			const inserted_indices: number[] = [];
			for (let i = group_size - 1; i >= 0; i--) {
				let search_end = to_sort + search_size;
				for (let j = inserted_indices.length - 1; j >= 0; j--) {
					if (inserted_indices[j] === search_end) {
						inserted_indices.splice(j, 1);
						search_size--;
						search_end--;
					}
					else {
						break;
					}
				}
				const bar = this.bars[i];
				const search_range = this.bars.slice(to_sort, search_end);
				yield* all(
					this.range.tween(2, search_range[0], search_range[search_range.length - 1]),
					this.range.stroke('white', 2),
					this.range.lineWidth(4, 2),
				);
				const insertion_index = binarySearch(search_range, bar, this.cmp);

				// Update inserted_indices
				{
					const v = to_sort + insertion_index - 1;
					const a = binarySearch(createSlice(inserted_indices), v, basic_cmp);
					for (let j = 0; j < a; j++) {
						inserted_indices[j]--;
					}
					inserted_indices.splice(a, 0, v);
				}

				const pair = this.getPair(i);
				yield* all(
					bar.layerOffset(bar.layerOffset() + 1, 2),
					group_rect().width((BAR_WIDTH + BAR_SPACING) * i, 2),
					...this.move(i, to_sort + insertion_index - 1), pair.lineWidth(0, 2)
				);
				to_sort--;
			}
		}
		if (this.has_loner) {
			const loner = this.bars[0];
			const search_range = this.bars.slice(to_sort);
			yield* all(
				this.range.tween(2, search_range[0], search_range[search_range.length - 1]),
				this.range.stroke('white', 2),
				this.range.lineWidth(4, 2),
			);

			const insertion_index = binarySearch(search_range, loner, this.cmp);
			// NOTE: the loner, by definition, does not have a pair
			yield* all(loner.lineWidth(0, 2), loner.layerOffset(loner.layerOffset() + 1, 2), ...this.move(0, to_sort + insertion_index - 1));
			to_sort--;
		}
		yield *all(...this.bars.map((bar) => bar.layerOffset(bar.layerOffset() - 1, 1)), this.range.lineWidth(0, 1), this.jacob.remove(1));
	}
}

function count_cmp<T>(cmp: CmpFn<T>): [CmpFn<T>, () => number] {
	let count = createSignal(0);
	const get_count = () => count();
	const cmp_fn = (a: T, b: T) => {
		console.log(1);
		count(count() + 1);
		return cmp(a, b);
	};
	return [cmp_fn, get_count];
}

function binarySearch<T>(arr: Slice<T>, value: T, cmp: CmpFn<T> = basic_cmp<T>) {
	let start = 0;
	let end = arr.length;
	while (start != end) {
		const mid = Math.floor((start + end) / 2);
		const eq = cmp(value, arr[mid]);
		if (eq === Eq.EQUAL) {
			return mid + 1;
		}
		if (eq === Eq.GREAT) {
			start = mid + 1;
		}
		else {
			end = mid;
		}
	}
	return end;
}

