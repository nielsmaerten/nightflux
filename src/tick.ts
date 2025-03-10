import config from './config';

export default function onTick() {
  console.log('Tick!');
  console.log('Configuration:', config);
}
