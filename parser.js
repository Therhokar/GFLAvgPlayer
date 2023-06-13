function getTagType(closeTag, section=1) {
  return { section: section, closeTag: closeTag };
}

var tagTypeDict = Object.create(null);
Object.assign(tagTypeDict, {
  bg_move: [true],
  bgm: [true],
  bin: [true],
  bin_slowin: [false],
  branchstyle: [true],
  cg: [true],
  cgdelay: [true],
  common_effect: [true],
  controll_shake: [true],
  delay: [true],
  duration: [true],
  gradienthide: [true, 0],
  gradientshow: [true, 0],
  grey: [false, 0],
  hide_dialogue: [false],
  inputbox: [true],
  narrator: [false],
  night: [false],
  pic: [true],
  position: [true, 0],
  rate: [true],
  scale: [true, 0],
  se: [true],
  se1: [true],
  se2: [true],
  se3: [true],
  shake: [true, 0],
  speaker: [true, 0],
  t: [true],
  tips: [true],
  '白屏1': [undefined],
  '白屏2': [undefined],
  '白屏闪光': [false],
  '边框': [true],
  '分支': [true],
  '刮花': [false],
  '关闭火花': [false],
  '关闭蒙版': [false],
  '黑点1': [undefined],
  '黑点2': [undefined],
  '黑屏1': [undefined],
  '黑屏2': [undefined],
  '回忆': [false],
  '火花': [false],
  '火花关闭': [false],
  '开火': [false],
  '快跑': [false],
  '立绘振动': [false],
  '名单': [false],
  '名单2': [true],
  '平移': [false],
  '闪屏': [true],
  '同时点亮': [false, 0],
  '同时置暗': [false, 0],
  '通讯框': [false, 0],
  '震屏': [false],
  '震屏1': [false],
  '震屏3': [false],
  '睁眼': [false]
});
Object.freeze(tagTypeDict);

function Tag(tag) {
  this.__proto__ = null;
  var tagName = new String(tag);
  var sep = tagName.indexOf(' ');
  this.tagName = (sep != -1 ? tagName.slice(0, sep) : tagName).toLowerCase();
  this.type = getTagType(...tagTypeDict[this.tagName]);
  this.attributes = sep != -1 ? tagName.slice(sep+1) : undefined;
}

function castSize(match, p1, offset, string) {
  var size = p1/41.3;
  return `<span style="font-size:calc(${size}*100%);">`;
}

function processLine(orig) {
  var line = orig
    .replace(/<color=(#?[0-9A-Za-z]+)>/gi, '<span style="color:$1">')
    .replace(/<size=([0-9]+)>/gi, castSize)
    .replace(/<\/(color|size)>/gi, '</span>');
  return line;
}

function parseInnerTags(str) {
  var pos = 0, len = str.length, tags = [];
  while (pos < len && str[pos] == '<') {
    pos++;
    var tag = [];
    while (pos < len && str[pos] != '>') {
      tag.push(str[pos]);
      pos++;
    }
    pos++;
    if (!tag.length) continue;
    tag = new Tag(tag.join('').replace('<', ''));
    if (!tag.type) console.warn(tag.tagName);
    if (tag.type.closeTag !== false) {
      var content = [];
      while (pos < len && str[pos] != '<') {
        content.push(str[pos]);
        pos++;
      }
      pos++;
      tag.content = content.join('');
      if (pos < len && str[pos] == '/') {
        pos += tag.tagName.length + 2;
      }
    }
    if ((tag.type.closeTag && tag.content) || !tag.type.closeTag) {
      tags.push(tag);
    }
  }
  return tags;
}

class AvgParser {
  /** @private {!number} Position in current line */
  col_ = 0;
  /** @private {!string} Line that is being processed */
  currentRow_ = undefined;
  /** @param {!string} s Text to set as the script */
  setScript(script) {
    /** @private {!Array<!string>} Array of lines in the script */
    this.script_ = script.replace(/\r\n/g, '\n').replaceAll('\r', '\n').split('\n').filter(s => s != '');
    /** @private {!number} Number of lines in the script */
    this.rowcount_ = this.script_.length;
    /** @private {!Set} Pictures that don't have corresponding file name in charPicDict */
    this.picsMissingMapping_ =  new Set();
  }
  /** @private Move current position in current line ahead by 1 */
  succeed_() {
    this.col_++;
  }
  /**
   * Move current position in current line ahead by n.
   * @private
   * @param {!number} n Number of steps to move ahead.
   */
  seek_(n) {
    for (var i = 0; i < n; i++) {
      this.col_++;
    }
  }
  /** @private Collect character avg picture file name */
  collectPic_() {
    var row = this.currentRow_;
    var code = [], num = [];
    while (true) {
      var char = row[this.col_];
      this.succeed_();
      if (char != '(') code.push(char);
      else break;
    }
    while (true) {
      var char = row[this.col_];
      this.succeed_();
      if (char != ')') num.push(char);
      else break;
    }
    code = code.join('');
    num = num.join('');
    var pic;
    /** @desc charPicDict An object to look up image url by code and num */
    if (code && num) pic = charPicDict[code+'('+num+')'];
    else pic = undefined;
    if (code && num && !pic) {
      this.picsMissingMapping_.add(code + '(' + num + ')');
    }
    return [pic, row[this.col_]];
  }
  /**
   * Collect tags following a character avg picture
   * @private
   * @param {!Array<!string>} endSigns Characters that signal the end of the section
   * @return {!Array<!Tag>}
   */
  collectTags_(endSigns) {
    var row = this.currentRow_;
    var tags = [];
    while (row[this.col_] == '<') {
      var tag = [];
      this.succeed_();
      while (true) {
        var char = row[this.col_];
        this.succeed_();
        if (char != '>') tag.push(char);
        else break;
      }
      if (!tag.length) {
        this.succeed_();
        continue;
      }
      tag = new Tag(tag.join('').replace('<', ''));
      if (!tag.type) console.warn(tag.tagName);
      if (tag.type.closeTag !== false) {
        var content = [];
        if (tag.tagName == '闪屏') {
          const endTag = '</' + tag.tagName + '>', tagLen = endTag.length;
          while (!(
              row.slice(this.col_).toLowerCase().startsWith(endTag) ||
              endSigns.includes(row[this.col_]))) {
            content.push(row[this.col_]);
            this.succeed_();
          }
          var innerTags = parseInnerTags(content.join(''));
          tag.params = Object.create(null);
          for (const inTag of innerTags) {
            console.debug(inTag);
            switch (inTag.tagName) {
              case 'delay':
              case 'duration':
              case 'rate':
                tag.params[inTag.tagName] = +inTag.content;
                break;
              case 'cg':
                tag.params.cg = inTag.content.split(',');
                break;
              case 'pic':
                let picSequence = inTag.content.split(',');
                for (let pi = 0; pi < picSequence.length; pi++) {
                  let pics = picSequence[pi].split('&').slice(1,-1).map(pc => charPicDict[pc.slice(1,-1)]);
                  picSequence[pi] = pics;
                }
                tag.params.pic = picSequence;
            }
          }
        } else {
          while (row[this.col_] != '<' && !endSigns.includes(row[this.col_])) {
            content.push(row[this.col_]);
            this.succeed_();
          }
        }
        if (!endSigns.includes(row[this.col_])) {
          this.succeed_();
          if (row[this.col_] == '/') {
            this.seek_(tag.tagName.length+2);
            tag.content = content.join('');
          } else {
            //this.seek_(tag.tagName.length+1);
            this.col_--;
          }
        }
      }
      if ((tag.type.closeTag && tag.content) || !tag.type.closeTag) {
        if (tag.tagName == '闪屏') delete tag.content;
        tags.push(tag);
      }
      while (row[this.col_] == ' ') this.succeed_();
    }
    return tags;
  }
  /**
   * Parse information of characters in a line into object
   * @private
   * @return {object|undefined}
   */
  parseChars_() {
    var row = this.currentRow_;
    var speaker = undefined, pics = [], speakerIndex = -1, teles = [], misplacedTags = [];
    if (row.startsWith('()||')) {
      this.seek_(4);
      return;
    }
    while (row.slice(this.col_, this.col_+2) != '||') {
      var [pic, next] = this.collectPic_();
      pic = {file: pic}
      var tags = undefined;
      if (next == '<') tags = this.collectTags_(['|']);
      if (tags) {
        var speakerTag = tags.find(tag => tag.tagName == 'speaker');
        if (speakerTag) {
          speaker = speakerTag.content;
          speakerIndex = pics.length;
        }
        if (tags.some(tag => tag.name == '通讯框')) {
          teles.push(pics.length);
        }
        var positionTag = tags.find(tag => tag.tagName == 'position');
        if (positionTag) {
          pic.position = positionTag.content.split(',').map(x => +x);
        }
        while (row[this.col_] == ';' || row[this.col_] == ' ') {
          this.succeed_();
        }
        pics.push(pic)
        misplacedTags = misplacedTags.concat(tags.filter(tag => tag.type.section != 0));
      }
    }
    while (row[this.col_] == '|') this.succeed_();
    return {
      pics: pics,
      speaker: speaker,
      speakerIndex: speakerIndex,
      teles: teles,
      misplacedTags: misplacedTags
    }
  }
  /**
   * Parse effect settings in a line into array of tags
   * @private
   * @return {!Array<!Tag>}
   */
  parseEffects_() {
    var row = this.currentRow_;
    var tags = [];
    if (row[this.col_] == ':' || row[this.col_] == '：') {
      this.succeed_();
      return [];
    }
    while (row[this.col_] != ':' && row[this.col_] != '：') {
      tags = tags.concat(this.collectTags_([':', '：']));
      while (row[this.col_] != '<' && row[this.col_] != ':' && row[this.col_] != '：') {
        this.succeed_();
      }
    }
    this.succeed_();
    return tags;
  }
  /**
   * Parse lines to convert tags into HTML elements, split at '+' sign, and find possible options
   * @private
   * @return {Array<string>}
   */
  parseLines_() {
    var row = this.currentRow_;
    var line = Object.create(null);
    line.lines = row.slice(this.col_).split('+').map(l => processLine(l));
    var lastLine = lines[lines.length-1];
    var optionTag = lastLine.match(/<cg?>/gi);
    var options = undefined;
    if (optionTag) {
      optionTag = optionTag[0].slice(1, -1);
      [lastLine, ...options] = lastLine.split(/<cg?>/gi);
      line.lines[line.lines.length-1] = lastLine;
      line.optionTag = optionTag;
      line.options = options;
    }
    return line;
  }
  /**
   * Parse lines into array of objects
   * @return {Array<object>|undefined}
   */
  parse() {
    if (!this.script_) {
      console.warn('Script is not set or empty. Parsing will not procceed.');
      return;
    }
    var unmarshalled = [];
    for (var i = 0; i < this.rowcount_; i++) {
      this.currentRow_ = this.script_[i];
      this.col_ = 0;
      var line = {};
      line.chars = this.parseChars_();
      line.effects = this.parseEffects_();
      if (line.chars) {
        line.effects = line.effects.concat(line.chars.misplacedTags);
        delete line.chars.misplacedTags;
      }
      const branchTagPos = line.effects.findIndex(tag => tag.tagName == '分支');
      if (branchTagPos != -1) {
        line.branch = +line.effects[branchTagPos].content;
        line.effects.splice(branchTagPos, 1);
      }
      Object.assign(line, this.parseLines_());
      unmarshalled.push(line);
    }
    let turningPoint, branchLastLines = [];
    for (let i = 0; i < unmarshalled.length; i++) {
      if (unmarshalled[i].optionTag) {
        turningPoint = i;
        unmarshalled[i].entries = new Map();
      } else if (unmarshalled[i].branch) {
        const branch = unmarshalled[i].branch;
        if (!unmarshalled[turningPoint].entries.has(branch)) {
          unmarshalled[turningPoint].entries.set(branch, i);
          if (!unmarshalled[i-1].optionTag) {
            branchLastLines.push(i-1);
          }
        }
      }
      if (i > 0 && !unmarshalled[i].branch && unmarshalled[i-1].branch) {
        for (const j of branchLastLines) {
          unmarshalled[j].exit = i;
        }
      }
    }
    if (this.picsMissingMapping_.size) {
      console.group('Pic_Missing');
      this.picsMissingMapping_.forEach(v => {console.log(v)});
      console.groupEnd();
    }
    return unmarshalled;
  }
}