import { Random } from '@motion-canvas/core';
import chroma from 'chroma-js';

export class OkLCH {
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

	as_libchroma() {
		return chroma.oklch(this.lightness, this.chroma, this.hue, this.alpha);
	}
}

export function shuffle<T>(arr: T[], random: Random) {
	for (let len = arr.length; len > 0; len--) {
		const i = random.nextInt(0, len);
		const item = arr[i];
		arr.splice(i, 1);
		arr.push(item);
	}
}


