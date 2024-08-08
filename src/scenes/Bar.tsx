import { initial, Rect, RectProps, signal, Txt } from "@motion-canvas/2d";
import { Origin, SignalValue, SimpleSignal } from "@motion-canvas/core";
import { BAR_NUM, BAR_SPACING, BAR_WIDTH, LAYER_OFFSET, MAX_BAR_HEIGHT, MIN_BAR_HEIGHT } from "./pmerge-me";
import { basic_cmp } from "./cmp";
import { OkLCH } from "./utils";
import chroma from 'chroma-js';

interface BarProps extends Omit<RectProps, 'position' | 'size' | 'x' | 'width' | 'height' | 'fill'> {
	value: SignalValue<number>,
	index: SignalValue<number>,
	layerOffset?: SignalValue<number>,
	color: SignalValue<OkLCH>;
}

export default class Bar extends Rect {
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

			fill: () => chroma.oklch(this.color().lightness, this.color().chroma, this.color().hue, this.color().alpha),

			...props
		});
		const fontSize = 20;
		this.add(<Txt fill={'#EEE'} fontSize={fontSize} y={() => -this.getOriginDelta(Origin.Middle).y + fontSize}>{this.value().toString()}</Txt>)
	}

	static cmp(a: Bar, b: Bar) {
		return basic_cmp(a.value(), b.value());
	}
}

