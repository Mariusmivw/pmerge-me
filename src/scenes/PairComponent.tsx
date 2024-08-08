import { Line, LineProps, signal } from "@motion-canvas/2d";
import { SignalValue, SimpleSignal } from "@motion-canvas/core";
import Bar from "./Bar";

export interface PairComponentProps extends Omit<LineProps, 'points'> {
	left_bar: SignalValue<Bar>,
	right_bar: SignalValue<Bar>,
}

export default class PairComponent extends Line {
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


