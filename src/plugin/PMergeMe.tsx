/* @jsxImportSource preact */

import { createSceneMetadata, ProjectMetadata, Scene, SceneState } from "@motion-canvas/core";
import { Pane, PhotoCamera, PluginTabConfig, PluginTabProps, Separator, Tab, useScenes } from "@motion-canvas/ui";
import project from "../project";

export const PMergeMeTabConfig: PluginTabConfig = {
	name: 'PMergeMe',
	tabComponent: PMergeMeTabComponent,
	paneComponent: PMergeMePaneComponent,
};

function PMergeMeTabComponent({tab}: PluginTabProps) {
	return (
		<Tab title="PMergeMe" id="pmerge-me-tab" tab={tab}>
			<PhotoCamera />
		</Tab>
	);
}

function PMergeMePaneComponent() {
	const scenes = useScenes();
	project.variables
	return (
		<Pane title="PMerge Me" id="pmerge-me-pane">
			<Separator size={1} />
			Hello <strong>World</strong>!
			<ProjectSettingsComponent />
			{
				scenes.map((scene) => (
					<SceneSettingsComponent scene={scene} />
				))
			}
		</Pane>
	);
}

function ProjectSettingsComponent({}: {}) {
	return (<></>)
}

function SceneSettingsComponent({scene}: {scene: Scene}) {
	return (<div><p>{scene.name}</p></div>);
}
