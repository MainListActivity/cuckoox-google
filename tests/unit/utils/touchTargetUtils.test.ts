import { describe, it, expect } from 'vitest';
import {
  MIN_TOUCH_TARGET,
  validateTouchTarget,
  getResponsiveTouchTargetSize,
  addTouchFriendlyProps,
  withMobileTouchOptimization,
  touchFriendlyButtonSx,
  touchFriendlyIconButtonSx,
  touchFriendlyFabSx,
  touchGestureConfig,
} from '@/src/utils/touchTargetUtils';

describe('touchTargetUtils', () => {
  describe('常量', () => {
    it('应该定义正确的最小触摸目标尺寸', () => {
      expect(MIN_TOUCH_TARGET).toBe(44);
    });
  });

  describe('validateTouchTarget', () => {
    it('应该正确验证满足触摸目标要求的尺寸', () => {
      expect(validateTouchTarget(44, 44)).toBe(true);
      expect(validateTouchTarget(48, 48)).toBe(true);
      expect(validateTouchTarget(44, 50)).toBe(true);
    });

    it('应该正确识别不满足触摸目标要求的尺寸', () => {
      expect(validateTouchTarget(40, 40)).toBe(false);
      expect(validateTouchTarget(44, 40)).toBe(false);
      expect(validateTouchTarget(40, 44)).toBe(false);
      expect(validateTouchTarget(30, 30)).toBe(false);
    });
  });

  describe('getResponsiveTouchTargetSize', () => {
    it('应该根据设备类型返回正确的触摸目标尺寸', () => {
      expect(getResponsiveTouchTargetSize('mobile')).toBe(48);
      expect(getResponsiveTouchTargetSize('tablet')).toBe(46);
      expect(getResponsiveTouchTargetSize('desktop')).toBe(44);
    });

    it('应该对未知设备类型返回默认尺寸', () => {
      // @ts-expect-error - 测试未知设备类型
      expect(getResponsiveTouchTargetSize('unknown')).toBe(44);
    });
  });

  describe('addTouchFriendlyProps', () => {
    it('应该正确添加触摸友好的属性', () => {
      const baseProps = { color: 'primary' };
      const result = addTouchFriendlyProps(baseProps);
      
      expect(result).toEqual({
        color: 'primary',
        sx: touchFriendlyIconButtonSx,
      });
    });

    it('应该合并现有的 sx 属性', () => {
      const baseProps = { 
        color: 'primary',
        sx: { fontSize: 16 }
      };
      const result = addTouchFriendlyProps(baseProps);
      
      expect(result.sx).toEqual({
        ...touchFriendlyIconButtonSx,
        fontSize: 16,
      });
    });

    it('应该处理空的 baseProps', () => {
      const result = addTouchFriendlyProps();
      
      expect(result).toEqual({
        sx: touchFriendlyIconButtonSx,
      });
    });
  });

  describe('withMobileTouchOptimization', () => {
    it('移动端应该使用移动优化的触摸目标', () => {
      const baseProps = { color: 'primary' };
      const result = withMobileTouchOptimization(baseProps, true);
      
      expect(result.sx).toBeDefined();
      // mobileOptimizedTouchSx 返回一个函数，接受 theme 参数
      expect(typeof result.sx).toBe('function');
    });

    it('非移动端应该使用标准触摸目标', () => {
      const baseProps = { color: 'primary' };
      const result = withMobileTouchOptimization(baseProps, false);
      
      expect(result.sx).toEqual(touchFriendlyIconButtonSx);
    });

    it('应该合并现有的 sx 属性', () => {
      const baseProps = { 
        color: 'primary',
        sx: { fontSize: 16 }
      };
      const result = withMobileTouchOptimization(baseProps, false);
      
      expect(result.sx).toEqual({
        ...touchFriendlyIconButtonSx,
        fontSize: 16,
      });
    });
  });

  describe('样式对象', () => {
    it('touchFriendlyButtonSx 应该包含必要的属性', () => {
      expect(touchFriendlyButtonSx).toHaveProperty('minWidth', MIN_TOUCH_TARGET);
      expect(touchFriendlyButtonSx).toHaveProperty('minHeight', MIN_TOUCH_TARGET);
      expect(touchFriendlyButtonSx).toHaveProperty('borderRadius', 2);
      expect(touchFriendlyButtonSx).toHaveProperty('display', 'flex');
      expect(touchFriendlyButtonSx).toHaveProperty('alignItems', 'center');
      expect(touchFriendlyButtonSx).toHaveProperty('justifyContent', 'center');
    });

    it('touchFriendlyIconButtonSx 应该包含必要的属性', () => {
      expect(touchFriendlyIconButtonSx).toHaveProperty('minWidth', MIN_TOUCH_TARGET);
      expect(touchFriendlyIconButtonSx).toHaveProperty('minHeight', MIN_TOUCH_TARGET);
      expect(touchFriendlyIconButtonSx).toHaveProperty('padding', 1);
    });

    it('touchFriendlyFabSx 应该包含 FAB 专用属性', () => {
      expect(touchFriendlyFabSx).toHaveProperty('width', 56);
      expect(touchFriendlyFabSx).toHaveProperty('height', 56);
    });
  });

  describe('手势配置', () => {
    it('应该定义正确的手势配置', () => {
      expect(touchGestureConfig.tap.threshold).toBe(10);
      expect(touchGestureConfig.tap.timeout).toBe(300);
      expect(touchGestureConfig.longPress.duration).toBe(500);
      expect(touchGestureConfig.longPress.movementThreshold).toBe(10);
      expect(touchGestureConfig.swipe.threshold).toBe(50);
      expect(touchGestureConfig.swipe.velocity).toBe(0.3);
    });
  });

  describe('边界情况', () => {
    it('应该处理负数尺寸', () => {
      expect(validateTouchTarget(-10, -10)).toBe(false);
      expect(validateTouchTarget(44, -10)).toBe(false);
    });

    it('应该处理零尺寸', () => {
      expect(validateTouchTarget(0, 0)).toBe(false);
      expect(validateTouchTarget(44, 0)).toBe(false);
    });

    it('应该处理极大尺寸', () => {
      expect(validateTouchTarget(1000, 1000)).toBe(true);
      expect(validateTouchTarget(44, 1000)).toBe(true);
    });
  });
});