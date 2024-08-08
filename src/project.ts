import {makeProject} from '@motion-canvas/core';

import pmerge_me from './scenes/pmerge-me?scene';

export default makeProject({
  scenes: [pmerge_me],
  variables: {test: 2},
  experimentalFeatures: true,
  plugins: [],
});
