import { hostname, platform } from 'os';

const whichPlatform = platform() === 'darwin' ? 'MAC' : 'win32';

export const config = {
  LINE_DOMAIN: 'gd2.line.naver.jp',
  LINE_OS_URL: 'os.line.naver.jp',
  LINE_HTTP_URL: '/api/v4/TalkService.do',
  LINE_STICKER_URL: 'dl.stickershop.line.naver.jp/products/',
  LINE_POLL_URL: '/P4',
  LINE_CERTIFICATE_URL: '/Q',
  LINE_SHOP_PATH: '/SHOP4',
  LINE_SESSION_LINE_URL: '/authct/v1/keys/line',
  LINE_SESSION_NAVER_URL: '/authct/v1/keys/naver',
  LINE_POST_CONTENT_URL: 'https://os.line.naver.jp/talk/m/upload.nhn',
  ip: '127.0.0.1',
  version: '5.1.2',
  revision: 0,
  hostname: hostname(),
  platform: whichPlatform,
  EMAIL_REGEX: /[^@]+@[^@]+\.[^@]+/,
  Headers: {
    'User-Agent': 'js-line (LINE for webapp)'
  }
}
