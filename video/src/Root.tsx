import React from 'react'
import { Composition } from 'remotion'
import TL from './timeline.json'
import { FPS } from './anim'
import { Main } from './Main'

export const Root: React.FC = () => (
  <Composition id="Main" component={Main} durationInFrames={Math.round(TL.total * FPS)} fps={FPS} width={1920} height={1080} />
)
