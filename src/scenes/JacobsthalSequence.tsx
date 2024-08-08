import { Node, Txt } from "@motion-canvas/2d";
import { all, createRef, Reference, waitFor } from "@motion-canvas/core";

export class JacobsthalSequence {
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

export class AnimatedJacobsthalSequence {
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
		}

		yield* waitFor(0.5);

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

		// Create answer
		{
			this.minus_equals_value_txt().text((this.power_of_2 - this.n).toFixed(0) + ' \u200b');
			const seconds = 0.75;
			yield* all(
				this.minus_equals_value_txt().opacity(1, seconds),
			);
		}

		yield* waitFor(0.25);

		// Move answer in
		{
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

