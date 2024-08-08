import {initial, Layout, Line, LineProps, makeScene2D, Node, NodeProps, Rect, RectProps, signal, Txt, View2D} from '@motion-canvas/2d';
import {all, createRef, createRefArray, createSignal, easeInCubic, easeInOutCubic, noop, Origin, Random, Reference, SignalValue, SimpleSignal, SimpleVector2Signal, ThreadGenerator, TimingFunction, tween, useRandom, useScene, Vector2, waitFor} from '@motion-canvas/core';
import chroma from 'chroma-js';

const BAR_NUM = 20;
const MIN_BAR_HEIGHT = 30;
const MAX_BAR_HEIGHT = 300;
const BAR_WIDTH = 50;
const BAR_SPACING = 10;
const HUE_RANGE = 300; // NOTE: to rotate hues the other way flip the sign
const HUE_START = 30;
const PAIRS_BEFORE_BULK = 5;
const LAYER_OFFSET = BAR_WIDTH / 2;
const SEARCH_RANGE_HEIGHT = 40;

const BAR_HUE_INCREASE = HUE_RANGE / BAR_NUM;

const SEPARATE_LAYER_OF_2 = true;

export default makeScene2D(function* (view) {
	const random = useRandom(2);

	const pmerge_me = new PMergeMeAnimator(view, random);
	yield* waitFor(0.75);
	yield* pmerge_me.shuffle();
	// yield* pmerge_me.use_order([3, 2, 4, 0, 1, 7, 6, 5, 8, 9]);
	// yield* pmerge_me.use_order([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
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

		this.root_layer = new PMergeMeAnimatorLayer(rect, this.random, createSlice([...bars]));
		if (order !== null) {
			this.root_layer.set_order(order);
		}
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
		this.add(<Txt fill={'#EEE'} fontSize={fontSize} y={() => -this.getOriginDelta(Origin.Middle).y + fontSize}>{this.value().toString()}</Txt>)
	}

	static cmp(a: Bar, b: Bar) {
		return basic_cmp(a.value(), b.value());
	}
}

interface SearchRangeProps extends Omit<LineProps, 'points'> {
	layer: number,
	left_bar: SignalValue<Bar>,
	right_bar: SignalValue<Bar>,
}

class SearchRange extends Line {
	@signal()
	public declare readonly left_bar: SimpleSignal<Bar, this>;

	@signal()
	public declare readonly right_bar: SimpleSignal<Bar, this>;

	private readonly layer: number;

	constructor(props?: SearchRangeProps) {
		const layer = props.layer;
		super({
			points: () => [
				[this.left_bar().index() * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, 0],
				[this.left_bar().index() * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, SEARCH_RANGE_HEIGHT],
				[(this.right_bar().index() + 1) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, SEARCH_RANGE_HEIGHT],
				[(this.right_bar().index() + 1) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, 0],
			],
			...props,
		});
		this.layer = layer;
	}

	*tween(seconds: number, new_left_bar: Bar, new_right_bar: Bar, ease: TimingFunction = easeInOutCubic) {
		const old_left_index = this.left_bar().index();
		const old_right_index = this.right_bar().index();
		const new_left_index = new_left_bar.index();
		const new_right_index = new_right_bar.index();

		yield* tween(seconds, (value) => {
			this.points([
				[ease(value, old_left_index, new_left_index) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, 0],
				[ease(value, old_left_index, new_left_index) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, SEARCH_RANGE_HEIGHT],
				[(ease(value, old_right_index, new_right_index) + 1) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, SEARCH_RANGE_HEIGHT],
				[(ease(value, old_right_index, new_right_index) + 1) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, 0],
			]);
		}, () => {
			this.left_bar(new_left_bar);
			this.right_bar(new_right_bar);
			this.points(() => [
				[this.left_bar().index() * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, 0],
				[this.left_bar().index() * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, SEARCH_RANGE_HEIGHT],
				[(this.right_bar().index() + 1) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, SEARCH_RANGE_HEIGHT],
				[(this.right_bar().index() + 1) * (BAR_WIDTH + BAR_SPACING) + this.layer * LAYER_OFFSET - 0.5 * BAR_SPACING, 0],
			]);
		});
	}
}

class AnimatedJacobsthalSequence {
	private power_of_2: number;
	private n: number;

	private p2_txt: Reference<Txt>;
	private p2_value_txt: Reference<Txt>;
	private p2_new_value_txt: Reference<Txt>;

	private n_txt: Reference<Txt>;
	private n_value_txt: Reference<Txt>;

	private minus_left_txt: Reference<Txt>;
	private minus_left_invis_txt: Reference<Txt>;
	private minus_left_moving_txt: Reference<Txt>;
	private minus_txt: Reference<Txt>;
	private minus_right_txt: Reference<Txt>;
	private minus_right_invis_txt: Reference<Txt>;
	private minus_right_moving_txt: Reference<Txt>;
	private minus_equals_txt: Reference<Txt>;
	private minus_equals_value_txt: Reference<Txt>;

	private self: Reference<Node>;

	/**
	 * @param [start_value=2] First value in the sequence (use 1 for index sequence, use 2 for the groupsize sequence)
	 */
	constructor(private readonly container: Node, private readonly start_value: number = 2) {
		this.power_of_2 = start_value;
		this.n = 0;

		this.p2_txt = createRef<Txt>();
		this.p2_value_txt = createRef<Txt>();
		this.p2_new_value_txt = createRef<Txt>();

		this.n_txt = createRef<Txt>();
		this.n_value_txt = createRef<Txt>();

		this.minus_left_txt = createRef<Txt>();
		this.minus_left_invis_txt = createRef<Txt>();
		this.minus_left_moving_txt = createRef<Txt>();
		this.minus_txt = createRef<Txt>();
		this.minus_right_txt = createRef<Txt>();
		this.minus_right_invis_txt = createRef<Txt>();
		this.minus_right_moving_txt = createRef<Txt>();
		this.minus_equals_txt = createRef<Txt>();
		this.minus_equals_value_txt = createRef<Txt>();

		this.self = createRef<Node>();
		const fill = '#DDD';
		this.container.add(
			<Node ref={this.self} opacity={0}>
				<Txt fill={fill}>
					<Txt ref={this.p2_txt}>Power of 2: {'\u200b'}</Txt>{'\n'}
					<Txt ref={this.n_txt}>N: {'\u200b'}</Txt>{'\n'}
					<Txt ref={this.minus_left_txt} opacity={0}>{this.power_of_2.toFixed(0)} {'\u200b'}</Txt>
				</Txt>

				<Txt fill={fill} ref={this.p2_value_txt} left={this.p2_txt().right}></Txt>
				<Txt fill={fill} ref={this.p2_new_value_txt} left={this.p2_value_txt().right} opacity={0}/>

				<Txt fill={fill} ref={this.n_value_txt} left={this.n_txt().right}>{this.n.toFixed(0)} {'\u200b'}</Txt>

				<Txt fill={fill} ref={this.minus_left_moving_txt} opacity={0}></Txt>
				<Txt fill={fill} ref={this.minus_left_invis_txt} left={this.minus_left_txt().left} opacity={0}></Txt>
				<Txt fill={fill} ref={this.minus_txt} left={this.minus_left_txt().right}>- {'\u200b'}</Txt>
				<Txt fill={fill} ref={this.minus_right_txt} left={this.minus_txt().right} opacity={0}>{this.n_value_txt().text()}</Txt>
				<Txt fill={fill} ref={this.minus_right_moving_txt} left={this.minus_txt().right} opacity={0}></Txt>
				<Txt fill={fill} ref={this.minus_right_invis_txt} left={this.minus_right_txt().left} opacity={0}></Txt>
				<Txt fill={fill} ref={this.minus_equals_txt} left={this.minus_right_txt().right}>= {'\u200b'}</Txt>
				<Txt fill={fill} ref={this.minus_equals_value_txt} left={this.minus_equals_txt().right} opacity={0}></Txt>
			</Node>
		);
	}

	next() {
		this.n = this.power_of_2 - this.n;
		this.power_of_2 *= 2;
		return this.n;
	}

	*animate_next() {
		if (this.self().opacity() === 0) {
			yield* this.self().opacity(1, 1);
		}

		// Slide in new power of 2
		{
			this.p2_new_value_txt().text((this.power_of_2).toFixed(0) + ' \u200b');
			yield* all(
				this.p2_new_value_txt().opacity(1, 0.75),
				this.p2_value_txt().opacity(0, 0.75),
				this.p2_value_txt().right(this.p2_txt().right, 0.75),
			);
			this.p2_value_txt().text(this.p2_new_value_txt().text());
			this.p2_value_txt().left(this.p2_txt().right),
			this.p2_value_txt().opacity(1);
			this.p2_new_value_txt().opacity(0);
			yield* waitFor(0.5);
		}

		// Slide left value in
		{
			this.minus_left_moving_txt().left(this.p2_value_txt().left);
			this.minus_left_moving_txt().text(this.p2_value_txt().text());
			this.minus_left_moving_txt().opacity(1);
			this.minus_left_invis_txt().text(this.minus_left_moving_txt().text());
			const seconds = 0.75;
			yield* all(
				this.minus_left_txt().opacity(0, seconds),
				this.minus_left_moving_txt().left(this.minus_left_txt().left, seconds),
				this.minus_txt().left(this.minus_left_invis_txt().right, seconds),
			);
			this.minus_left_txt().text(this.minus_left_invis_txt().text());
			this.minus_left_txt().opacity(1);
			this.minus_left_moving_txt().opacity(0);
			this.minus_txt().left(this.minus_left_txt().right);
		}

		// Slide right value in
		{
			this.minus_right_moving_txt().left(this.n_value_txt().left);
			this.minus_right_moving_txt().text(this.n_value_txt().text());
			this.minus_right_moving_txt().opacity(1);
			this.minus_right_invis_txt().text(this.minus_right_moving_txt().text());
			const seconds = 0.75;
			yield* all(
				this.minus_right_txt().opacity(0, seconds),
				this.minus_right_moving_txt().left(this.minus_right_txt().left, seconds),
				this.minus_equals_txt().left(this.minus_right_invis_txt().right, seconds),
			);
			this.minus_right_txt().text(this.minus_right_invis_txt().text());
			this.minus_right_txt().opacity(1);
			this.minus_right_moving_txt().opacity(0);
			this.minus_equals_txt().left(this.minus_right_txt().right);
		}

		// Create answer and move in
		{
			this.minus_equals_value_txt().text((this.power_of_2 - this.n).toFixed(0) + ' \u200b');
			const seconds = 0.75;
			yield* all(
				this.minus_equals_value_txt().opacity(1, seconds),
			);

			yield* waitFor(0.25);
			const seconds2 = 0.75;
			yield* all(
				this.n_value_txt().opacity(0, seconds2),
				this.n_value_txt().right(this.n_txt().right, seconds2),
				this.minus_equals_value_txt().left(this.n_txt().right, seconds2),
			);
			this.n_value_txt().text(this.minus_equals_value_txt().text());
			this.n_value_txt().left(this.n_txt().right);
			this.n_value_txt().opacity(1);
			this.minus_equals_value_txt().opacity(0);
			this.minus_equals_value_txt().left(this.minus_equals_txt().right);
		}
	}

	*remove(seconds: number) {
		yield* this.self().opacity(0, seconds);
		this.reset();
	}

	reset() {
		this.power_of_2 = this.start_value;
		this.n = 0;
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

	constructor(private container: Node, private random: Random, private bars: Slice<Bar>, private parent: null | PMergeMeAnimatorLayer = null) {
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

			const child = new PMergeMeAnimatorLayer(this.container, this.random, sub_bars, this);
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
				const insertion_index = binarySearch(search_range, bar, Bar.cmp);

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

			const insertion_index = binarySearch(search_range, loner, Bar.cmp);
			// NOTE: the loner, by definition, does not have a pair
			yield* all(loner.lineWidth(0, 2), loner.layerOffset(loner.layerOffset() + 1, 2), ...this.move(0, to_sort + insertion_index - 1));
			to_sort--;
		}
		yield *all(...this.bars.map((bar) => bar.layerOffset(bar.layerOffset() - 1, 1)), this.range.lineWidth(0, 1), this.jacob.remove(1));
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

function inverse<T>(cmp: (a: T, b: T) => Eq) {
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

function binarySearch<T>(arr: Slice<T>, value: T, cmp: (a: T, b: T) => Eq = basic_cmp<T>) {
	let start = 0;
	let end = arr.length;
	while (start != end) {
		const mid = Math.floor((start + end) / 2);
		const eq = cmp(arr[mid], value);
		if (eq === Eq.EQUAL) {
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

function shuffle<T>(arr: T[], random: Random) {
	for (let len = arr.length; len > 0; len--) {
		const i = random.nextInt(0, len);
		const item = arr[i];
		arr.splice(i, 1);
		arr.push(item);
	}
}

