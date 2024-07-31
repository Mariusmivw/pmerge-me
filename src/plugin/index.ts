import { makeEditorPlugin } from "@motion-canvas/ui";
import { PMergeMeTabConfig } from "./PMergeMe";

export default makeEditorPlugin(() => {
	return {
		name: 'PMergeMe',
		tabs: [PMergeMeTabConfig],
	};
});

