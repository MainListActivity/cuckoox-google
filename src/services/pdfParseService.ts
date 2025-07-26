// PDF解析服务API
import { 
  UploadResponse, 
  ParseResult, 
  FieldEditForm,
  InterestCalculationParams,
  InterestCalculationResult,
  DocumentTemplate,
  GeneratedDocument,
  BatchProcessSummary,
  BatchProcessResult,
  APIResponse
} from '@/src/types/pdfParser';

class PDFParseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/pdf';
  }

  /**
   * 上传PDF文件
   */
  async uploadFile(
    file: File, 
    caseId?: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (caseId) {
      formData.append('caseId', caseId);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        } else {
          reject(new Error(`上传失败: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('上传请求失败'));
      });

      xhr.open('POST', `${this.baseUrl}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${this.getAuthToken()}`);
      xhr.send(formData);
    });
  }

  /**
   * 获取解析结果
   */
  async getParseResult(parseId: string): Promise<ParseResult> {
    const response = await fetch(`${this.baseUrl}/parse-result/${parseId}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`获取解析结果失败: ${response.statusText}`);
    }

    const data: APIResponse<ParseResult> = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '获取解析结果失败');
    }

    return data.data!;
  }

  /**
   * 轮询解析状态
   */
  async pollParseStatus(parseId: string, onUpdate: (result: ParseResult) => void): Promise<void> {
    const poll = async () => {
      try {
        const result = await this.getParseResult(parseId);
        onUpdate(result);
        
        if (result.status === 'processing') {
          setTimeout(poll, 2000); // 2秒后再次轮询
        }
      } catch (error) {
        console.error('轮询解析状态失败:', error);
        setTimeout(poll, 5000); // 错误时5秒后重试
      }
    };

    poll();
  }

  /**
   * 更新字段值
   */
  async updateField(
    parseId: string, 
    fieldName: string, 
    fieldData: FieldEditForm
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/parse-result/${parseId}/field`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        fieldName,
        value: fieldData.value,
        reason: fieldData.reason
      })
    });

    if (!response.ok) {
      throw new Error(`更新字段失败: ${response.statusText}`);
    }

    const data: APIResponse = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '更新字段失败');
    }
  }

  /**
   * 计算利息
   */
  async calculateInterest(params: InterestCalculationParams): Promise<InterestCalculationResult> {
    const response = await fetch(`${this.baseUrl}/calculate-interest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`利息计算失败: ${response.statusText}`);
    }

    const data: APIResponse<InterestCalculationResult> = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '利息计算失败');
    }

    return data.data!;
  }

  /**
   * 获取文档模板列表
   */
  async getDocumentTemplates(): Promise<DocumentTemplate[]> {
    const response = await fetch(`${this.baseUrl}/document-templates`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`获取模板列表失败: ${response.statusText}`);
    }

    const data: APIResponse<DocumentTemplate[]> = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '获取模板列表失败');
    }

    return data.data!;
  }

  /**
   * 生成文档
   */
  async generateDocument(parseId: string, templateId: string): Promise<GeneratedDocument> {
    const response = await fetch(`${this.baseUrl}/generate-document/${parseId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ templateId })
    });

    if (!response.ok) {
      throw new Error(`生成文档失败: ${response.statusText}`);
    }

    const data: APIResponse<GeneratedDocument> = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '生成文档失败');
    }

    return data.data!;
  }

  /**
   * 保存生成的文档
   */
  async saveDocument(document: GeneratedDocument): Promise<string> {
    const response = await fetch(`${this.baseUrl}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(document)
    });

    if (!response.ok) {
      throw new Error(`保存文档失败: ${response.statusText}`);
    }

    const data: APIResponse<{ documentId: string }> = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '保存文档失败');
    }

    return data.data!.documentId;
  }

  /**
   * 批量上传文件
   */
  async uploadBatch(
    files: File[], 
    caseId?: string,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<string> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    if (caseId) {
      formData.append('caseId', caseId);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(-1, progress); // -1 表示整体进度
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.batchId);
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        } else {
          reject(new Error(`批量上传失败: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('批量上传请求失败'));
      });

      xhr.open('POST', `${this.baseUrl}/batch-upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${this.getAuthToken()}`);
      xhr.send(formData);
    });
  }

  /**
   * 获取批量处理状态
   */
  async getBatchStatus(batchId: string): Promise<BatchProcessSummary> {
    const response = await fetch(`${this.baseUrl}/batch/${batchId}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`获取批量状态失败: ${response.statusText}`);
    }

    const data: APIResponse<BatchProcessSummary> = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '获取批量状态失败');
    }

    return data.data!;
  }

  /**
   * 取消批量处理
   */
  async cancelBatch(batchId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/batch/${batchId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`取消批量处理失败: ${response.statusText}`);
    }

    const data: APIResponse = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '取消批量处理失败');
    }
  }

  /**
   * 重试失败的批量项目
   */
  async retryBatchItem(batchId: string, fileId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/batch/${batchId}/retry/${fileId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`重试失败: ${response.statusText}`);
    }

    const data: APIResponse = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '重试失败');
    }
  }

  /**
   * 删除解析结果
   */
  async deleteParseResult(parseId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/parse-result/${parseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`删除解析结果失败: ${response.statusText}`);
    }

    const data: APIResponse = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || '删除解析结果失败');
    }
  }

  /**
   * 导出解析结果
   */
  async exportParseResult(parseId: string, format: 'json' | 'excel' | 'pdf'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/parse-result/${parseId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ format })
    });

    if (!response.ok) {
      throw new Error(`导出失败: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * 获取认证令牌
   * 现在通过Service Worker管理token，直接发送请求让Service Worker处理认证
   */
  private getAuthToken(): string {
    // Token management is now handled by Service Worker
    // Service Worker will intercept requests and add authentication headers
    // Return empty string as Service Worker will handle token attachment
    return '';
  }
}

export const pdfParseService = new PDFParseService();