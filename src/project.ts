import {makeProject} from '@motion-canvas/core';

import example from './scenes/example?scene';
import PMergeMe from './plugin';

export default makeProject({
  scenes: [example],
  variables: {test: 2},
  experimentalFeatures: true,
  plugins: [PMergeMe()],
});
