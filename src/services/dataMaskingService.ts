/**
 * 数据脱敏服务
 * 对敏感字段进行自动脱敏处理，确保日志中不包含敏感信息
 */

import { RecordId } from 'surrealdb';

// 脱敏类型枚举
export enum MaskingType {
  PHONE = 'phone',           // 电话号码
  EMAIL = 'email',           // 邮箱地址
  ID_CARD = 'id_card',       // 身份证号
  BANK_CARD = 'bank_card',   // 银行卡号
  NAME = 'name',             // 姓名
  ADDRESS = 'address',       // 地址
  AMOUNT = 'amount',         // 金额
  CUSTOM = 'custom'          // 自定义脱敏
}

// 脱敏规则配置
export interface MaskingRule {
  field: string;                    // 字段名
  type: MaskingType;                // 脱敏类型
  maskChar: string;                 // 脱敏字符，默认为*
  preserveStart: number;            // 保留开头字符数
  preserveEnd: number;              // 保留结尾字符数
  customPattern?: RegExp;           // 自定义匹配模式
  customReplacer?: (value: string) => string; // 自定义替换函数
}

// 脱敏配置
export interface MaskingConfig {
  enabled: boolean;                 // 是否启用脱敏
  rules: MaskingRule[];            // 脱敏规则
  sensitiveFields: string[];       // 敏感字段列表
  logMasking: boolean;             // 是否记录脱敏日志
}

// 脱敏结果
export interface MaskingResult {
  originalData: any;
  maskedData: any;
  maskedFields: string[];
  maskingApplied: boolean;
}

class DataMaskingService {
  private defaultConfig: MaskingConfig = {
    enabled: true,
    logMasking: false,
    sensitiveFields: [
      'creditor_legal_id',
      'contact_phone', 
      'contact_email',
      'creditor_name',
      'contact_address',
      'bank_account',
      'bank_name',
      'principal',
      'interest',
      'total_amount'
    ],
    rules: [
      {
        field: 'creditor_legal_id',
        type: MaskingType.ID_CARD,
        maskChar: '*',
        preserveStart: 4,
        preserveEnd: 4
      },
      {
        field: 'contact_phone',
        type: MaskingType.PHONE,
        maskChar: '*',
        preserveStart: 3,
        preserveEnd: 4
      },
      {
        field: 'contact_email',
        type: MaskingType.EMAIL,
        maskChar: '*',
        preserveStart: 2,
        preserveEnd: 0
      },
      {
        field: 'creditor_name',
        type: MaskingType.NAME,
        maskChar: '*',
        preserveStart: 1,
        preserveEnd: 1
      },
      {
        field: 'contact_address',
        type: MaskingType.ADDRESS,
        maskChar: '*',
        preserveStart: 6,
        preserveEnd: 0
      },
      {
        field: 'bank_account',
        type: MaskingType.BANK_CARD,
        maskChar: '*',
        preserveStart: 4,
        preserveEnd: 4
      },
      {
        field: 'principal',
        type: MaskingType.AMOUNT,
        maskChar: '*',
        preserveStart: 0,
        preserveEnd: 2
      },
      {
        field: 'interest', 
        type: MaskingType.AMOUNT,
        maskChar: '*',
        preserveStart: 0,
        preserveEnd: 2
      },
      {
        field: 'total_amount',
        type: MaskingType.AMOUNT,
        maskChar: '*',
        preserveStart: 0,
        preserveEnd: 2
      }
    ]
  };

  private config: MaskingConfig;

  constructor(config?: Partial<MaskingConfig>) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * 更新脱敏配置
   */
  updateConfig(config: Partial<MaskingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 主要脱敏方法 - 处理单个对象
   */
  maskData(data: any, customRules?: MaskingRule[]): MaskingResult {
    if (!this.config.enabled || !data) {
      return {
        originalData: data,
        maskedData: data,
        maskedFields: [],
        maskingApplied: false
      };
    }

    const rules = customRules || this.config.rules;
    const maskedData = this.deepClone(data);
    const maskedFields: string[] = [];

    // 递归处理对象的所有字段
    this.processObject(maskedData, rules, maskedFields, '');

    const result: MaskingResult = {
      originalData: data,
      maskedData,
      maskedFields,
      maskingApplied: maskedFields.length > 0
    };

    if (this.config.logMasking && result.maskingApplied) {
      console.log(`Data masking applied to fields: ${maskedFields.join(', ')}`);
    }

    return result;
  }

  /**
   * 批量数据脱敏
   */
  maskDataArray(dataArray: any[], customRules?: MaskingRule[]): MaskingResult[] {
    if (!Array.isArray(dataArray)) {
      return [this.maskData(dataArray, customRules)];
    }

    return dataArray.map(item => this.maskData(item, customRules));
  }

  /**
   * 处理操作日志数据脱敏
   */
  maskOperationLogData(logData: any): MaskingResult {
    // 操作日志特定的脱敏规则
    const operationLogRules: MaskingRule[] = [
      ...this.config.rules,
      {
        field: 'before_data',
        type: MaskingType.CUSTOM,
        maskChar: '*',
        preserveStart: 0,
        preserveEnd: 0,
        customReplacer: (value: string) => {
          if (typeof value === 'object') {
            return this.maskData(value).maskedData;
          }
          return value;
        }
      },
      {
        field: 'after_data',
        type: MaskingType.CUSTOM,
        maskChar: '*',
        preserveStart: 0,
        preserveEnd: 0,
        customReplacer: (value: string) => {
          if (typeof value === 'object') {
            return this.maskData(value).maskedData;
          }
          return value;
        }
      },
      {
        field: 'ip_address',
        type: MaskingType.CUSTOM,
        maskChar: '*',
        preserveStart: 7, // 保留前7位 (xxx.xxx)
        preserveEnd: 0,
        customPattern: /^(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}$/,
        customReplacer: (ip: string) => {
          const match = ip.match(/^(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}$/);
          return match ? `${match[1]}.***.**` : '***.**.**.**';
        }
      }
    ];

    return this.maskData(logData, operationLogRules);
  }

  /**
   * 处理统计数据脱敏
   */
  maskStatisticsData(statsData: any): MaskingResult {
    // 统计数据通常只需要脱敏个人标识信息
    const statisticsRules: MaskingRule[] = [
      {
        field: 'reviewer_name',
        type: MaskingType.NAME,
        maskChar: '*',
        preserveStart: 1,
        preserveEnd: 0
      },
      {
        field: 'operator_name',
        type: MaskingType.NAME,
        maskChar: '*',
        preserveStart: 1,
        preserveEnd: 0
      },
      {
        field: 'creditor_name',
        type: MaskingType.NAME,
        maskChar: '*',
        preserveStart: 1,
        preserveEnd: 1
      }
    ];

    return this.maskData(statsData, statisticsRules);
  }

  /**
   * 递归处理对象
   */
  private processObject(obj: any, rules: MaskingRule[], maskedFields: string[], path: string): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.processObject(item, rules, maskedFields, `${path}[${index}]`);
      });
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      
      // 检查是否需要脱敏该字段
      const rule = this.findMatchingRule(key, fieldPath, rules);
      
      if (rule && value != null) {
        const maskedValue = this.applyMasking(value, rule);
        if (maskedValue !== value) {
          obj[key] = maskedValue;
          maskedFields.push(fieldPath);
        }
      } else if (typeof value === 'object') {
        // 递归处理嵌套对象
        this.processObject(value, rules, maskedFields, fieldPath);
      }
    }
  }

  /**
   * 查找匹配的脱敏规则
   */
  private findMatchingRule(fieldName: string, fieldPath: string, rules: MaskingRule[]): MaskingRule | null {
    // 优先匹配完整路径
    let rule = rules.find(r => r.field === fieldPath);
    if (rule) return rule;

    // 匹配字段名
    rule = rules.find(r => r.field === fieldName);
    if (rule) return rule;

    // 检查是否为敏感字段
    if (this.config.sensitiveFields.includes(fieldName)) {
      return {
        field: fieldName,
        type: MaskingType.CUSTOM,
        maskChar: '*',
        preserveStart: 2,
        preserveEnd: 2
      };
    }

    return null;
  }

  /**
   * 应用脱敏规则
   */
  private applyMasking(value: any, rule: MaskingRule): any {
    if (value == null) return value;

    // 如果有自定义替换函数，优先使用
    if (rule.customReplacer) {
      try {
        return rule.customReplacer(String(value));
      } catch (error) {
        console.warn('Custom masking replacer error:', error);
        return this.defaultMask(String(value), rule);
      }
    }

    const stringValue = String(value);

    switch (rule.type) {
      case MaskingType.PHONE:
        return this.maskPhone(stringValue, rule);
      
      case MaskingType.EMAIL:
        return this.maskEmail(stringValue, rule);
      
      case MaskingType.ID_CARD:
        return this.maskIdCard(stringValue, rule);
      
      case MaskingType.BANK_CARD:
        return this.maskBankCard(stringValue, rule);
      
      case MaskingType.NAME:
        return this.maskName(stringValue, rule);
      
      case MaskingType.ADDRESS:
        return this.maskAddress(stringValue, rule);
      
      case MaskingType.AMOUNT:
        return this.maskAmount(value, rule);
      
      case MaskingType.CUSTOM:
        if (rule.customPattern) {
          return this.maskWithPattern(stringValue, rule);
        }
        return this.defaultMask(stringValue, rule);
      
      default:
        return this.defaultMask(stringValue, rule);
    }
  }

  /**
   * 脱敏电话号码
   */
  private maskPhone(phone: string, rule: MaskingRule): string {
    // 移除非数字字符用于处理
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length < 7) {
      return this.defaultMask(phone, rule);
    }

    if (digits.length === 11) {
      // 手机号码格式：138****1234
      return phone.replace(/(\d{3})\d{4}(\d{4})/, `$1${rule.maskChar.repeat(4)}$2`);
    } else if (digits.length >= 7) {
      // 固定电话等其他格式
      return this.defaultMask(phone, rule);
    }

    return phone;
  }

  /**
   * 脱敏邮箱地址
   */
  private maskEmail(email: string, rule: MaskingRule): string {
    const emailRegex = /^([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
    const match = email.match(emailRegex);
    
    if (!match) {
      return this.defaultMask(email, rule);
    }

    const [, username, domain] = match;
    const maskedUsername = this.defaultMask(username, rule);
    
    return `${maskedUsername}@${domain}`;
  }

  /**
   * 脱敏身份证号
   */
  private maskIdCard(idCard: string, rule: MaskingRule): string {
    if (idCard.length !== 18 && idCard.length !== 15) {
      return this.defaultMask(idCard, rule);
    }

    // 身份证格式：1234**********5678
    const start = idCard.substring(0, rule.preserveStart);
    const end = idCard.substring(idCard.length - rule.preserveEnd);
    const maskLength = idCard.length - rule.preserveStart - rule.preserveEnd;
    
    return start + rule.maskChar.repeat(maskLength) + end;
  }

  /**
   * 脱敏银行卡号
   */
  private maskBankCard(cardNumber: string, rule: MaskingRule): string {
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.length < 12) {
      return this.defaultMask(cardNumber, rule);
    }

    // 银行卡格式：1234 **** **** 5678
    const start = digits.substring(0, rule.preserveStart);
    const end = digits.substring(digits.length - rule.preserveEnd);
    const maskLength = digits.length - rule.preserveStart - rule.preserveEnd;
    
    const masked = start + rule.maskChar.repeat(maskLength) + end;
    
    // 保持原有的格式（空格等）
    return cardNumber.replace(/\d/g, (match, index) => {
      const digitIndex = cardNumber.substring(0, index + 1).replace(/\D/g, '').length - 1;
      return masked[digitIndex] || match;
    });
  }

  /**
   * 脱敏姓名
   */
  private maskName(name: string, rule: MaskingRule): string {
    if (name.length <= 2) {
      return rule.maskChar + name.substring(1);
    }

    const start = name.substring(0, rule.preserveStart);
    const end = name.substring(name.length - rule.preserveEnd);
    const maskLength = Math.max(0, name.length - rule.preserveStart - rule.preserveEnd);
    
    return start + rule.maskChar.repeat(maskLength) + end;
  }

  /**
   * 脱敏地址
   */
  private maskAddress(address: string, rule: MaskingRule): string {
    if (address.length <= rule.preserveStart) {
      return address;
    }

    const start = address.substring(0, rule.preserveStart);
    const maskLength = Math.min(10, address.length - rule.preserveStart); // 最多脱敏10个字符
    
    return start + rule.maskChar.repeat(maskLength) + '...';
  }

  /**
   * 脱敏金额
   */
  private maskAmount(amount: any, rule: MaskingRule): string {
    const numValue = typeof amount === 'number' ? amount : parseFloat(String(amount));
    
    if (isNaN(numValue)) {
      return this.defaultMask(String(amount), rule);
    }

    // 金额脱敏：保留小数点后几位，其他用*代替
    const amountStr = numValue.toFixed(2);
    const parts = amountStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    if (integerPart.length <= 2) {
      return `****.${decimalPart}`;
    }

    const maskedInteger = rule.maskChar.repeat(integerPart.length - 2) + integerPart.slice(-2);
    return `${maskedInteger}.${decimalPart}`;
  }

  /**
   * 使用自定义模式脱敏
   */
  private maskWithPattern(value: string, rule: MaskingRule): string {
    if (!rule.customPattern) {
      return this.defaultMask(value, rule);
    }

    const match = value.match(rule.customPattern);
    if (!match) {
      return this.defaultMask(value, rule);
    }

    // 使用自定义替换函数
    if (rule.customReplacer) {
      return rule.customReplacer(value);
    }

    return this.defaultMask(value, rule);
  }

  /**
   * 默认脱敏方法
   */
  private defaultMask(value: string, rule: MaskingRule): string {
    if (value.length <= rule.preserveStart + rule.preserveEnd) {
      return rule.maskChar.repeat(Math.min(value.length, 3));
    }

    const start = value.substring(0, rule.preserveStart);
    const end = value.substring(value.length - rule.preserveEnd);
    const maskLength = value.length - rule.preserveStart - rule.preserveEnd;
    
    return start + rule.maskChar.repeat(maskLength) + end;
  }

  /**
   * 深度克隆对象
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof RecordId) {
      return new RecordId(obj.tb, obj.id);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.deepClone(value);
    }

    return cloned;
  }

  /**
   * 检查字段是否为敏感字段
   */
  isSensitiveField(fieldName: string): boolean {
    return this.config.sensitiveFields.includes(fieldName) ||
           this.config.rules.some(rule => rule.field === fieldName);
  }

  /**
   * 添加自定义脱敏规则
   */
  addMaskingRule(rule: MaskingRule): void {
    const existingIndex = this.config.rules.findIndex(r => r.field === rule.field);
    if (existingIndex >= 0) {
      this.config.rules[existingIndex] = rule;
    } else {
      this.config.rules.push(rule);
    }
  }

  /**
   * 移除脱敏规则
   */
  removeMaskingRule(fieldName: string): void {
    this.config.rules = this.config.rules.filter(rule => rule.field !== fieldName);
  }

  /**
   * 获取当前配置
   */
  getConfig(): MaskingConfig {
    return { ...this.config };
  }

  /**
   * 验证脱敏规则
   */
  validateRule(rule: MaskingRule): boolean {
    if (!rule.field || !rule.type || rule.preserveStart < 0 || rule.preserveEnd < 0) {
      return false;
    }

    if (rule.type === MaskingType.CUSTOM && !rule.customReplacer && !rule.customPattern) {
      return false;
    }

    return true;
  }
}

export const dataMaskingService = new DataMaskingService();