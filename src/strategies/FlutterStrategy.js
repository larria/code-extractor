import BaseStrategy from './BaseStrategy.js';

export default class FlutterStrategy extends BaseStrategy {
  get type() { return 'flutter'; }

  match(files) {
    return files.includes('pubspec.yaml');
  }

  getIgnoreList() {
    return [
      '.dart_tool', 
      '.idea', 
      'ios/Flutter', 
      'android/.gradle',
      'build' // flutter build output
    ];
  }
}