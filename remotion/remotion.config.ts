/**
 * Remotion Configuration
 * H.264 MP4 1080p Export for Social Media (Twitter/X, LinkedIn, YouTube Shorts, Reels)
 */
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setCrf(18); // High visual fidelity
Config.setPixelFormat('yuv420p'); // Universal social media compatibility
