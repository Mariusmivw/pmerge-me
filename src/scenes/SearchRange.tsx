import { Line, LineProps, signal } from "@motion-canvas/2d";
import { easeInOutCubic, SignalValue, SimpleSignal, TimingFunction, tween } from "@motion-canvas/core";
import Bar from "./Bar";
import { BAR_SPACING, BAR_WIDTH, LAYER_OFFSET, SEARCH_RANGE_HEIGHT } from "./pmerge-me";

export interface SearchRangeProps extends Omit<LineProps, 'points'> {
	layer: number,
	left_bar: SignalValue<Bar>,
	right_bar: SignalValue<Bar>,
}

export default class SearchRange extends Line {
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


