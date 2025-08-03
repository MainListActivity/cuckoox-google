-- ===============================================
-- WebRTC权限系统集成迁移脚本
-- 为WebRTC功能添加操作权限定义
-- ===============================================

-- 添加WebRTC相关操作权限到 operation_metadata 表
INSERT INTO operation_metadata (operation_id, menu_id, operation_name, operation_type, description, tables, is_active, created_at, updated_at) VALUES 

-- 基础通话权限
('webrtc_voice_call_initiate', 'messages', '发起语音通话', 'create', '向其他用户发起语音通话', ['message'], true, time::now(), time::now()),
('webrtc_video_call_initiate', 'messages', '发起视频通话', 'create', '向其他用户发起视频通话', ['message'], true, time::now(), time::now()),
('webrtc_call_answer', 'messages', '接听通话', 'update', '接听来电请求', ['message'], true, time::now(), time::now()),
('webrtc_call_reject', 'messages', '拒绝通话', 'update', '拒绝来电请求', ['message'], true, time::now(), time::now()),
('webrtc_call_end', 'messages', '结束通话', 'update', '结束正在进行的通话', ['message'], true, time::now(), time::now()),

-- 媒体控制权限
('webrtc_camera_toggle', 'messages', '控制摄像头', 'update', '开启或关闭摄像头', ['message'], true, time::now(), time::now()),
('webrtc_microphone_toggle', 'messages', '控制麦克风', 'update', '开启或关闭麦克风', ['message'], true, time::now(), time::now()),
('webrtc_speaker_toggle', 'messages', '控制扬声器', 'update', '开启或关闭扬声器', ['message'], true, time::now(), time::now()),
('webrtc_screen_share', 'messages', '屏幕共享', 'update', '共享屏幕内容', ['message'], true, time::now(), time::now()),

-- 群组通话权限
('webrtc_group_call_create', 'messages', '创建群组通话', 'create', '创建多人会议通话', ['message', 'group'], true, time::now(), time::now()),
('webrtc_group_call_join', 'messages', '加入群组通话', 'update', '加入现有的群组通话', ['message', 'group'], true, time::now(), time::now()),
('webrtc_group_call_invite', 'messages', '邀请加入通话', 'create', '邀请其他用户加入群组通话', ['message', 'group'], true, time::now(), time::now()),
('webrtc_group_call_manage', 'messages', '管理群组通话', 'update', '管理群组通话参与者和设置', ['message', 'group'], true, time::now(), time::now()),

-- 文件传输权限  
('webrtc_file_send', 'messages', '发送文件', 'create', '通过WebRTC发送文件', ['message'], true, time::now(), time::now()),
('webrtc_file_receive', 'messages', '接收文件', 'update', '接收其他用户发送的文件', ['message'], true, time::now(), time::now()),
('webrtc_media_upload', 'messages', '上传媒体文件', 'create', '上传图片、视频、音频文件', ['message'], true, time::now(), time::now()),

-- 消息系统权限
('webrtc_message_send', 'messages', '发送即时消息', 'create', '在通话中发送文字消息', ['message'], true, time::now(), time::now()),
('webrtc_message_view', 'messages', '查看通话记录', 'read', '查看通话历史记录', ['message'], true, time::now(), time::now()),
('webrtc_message_delete', 'messages', '删除通话记录', 'delete', '删除通话历史记录', ['message'], true, time::now(), time::now()),

-- 高级功能权限
('webrtc_recording_start', 'messages', '开始录制', 'create', '录制通话内容（需要管理员权限）', ['message'], true, time::now(), time::now()),
('webrtc_recording_stop', 'messages', '停止录制', 'update', '停止正在进行的录制', ['message'], true, time::now(), time::now()),
('webrtc_quality_control', 'messages', '调整通话质量', 'update', '调整音视频质量设置', ['message'], true, time::now(), time::now()),
('webrtc_network_monitor', 'messages', '网络监控', 'read', '查看网络连接状态和质量', ['message'], true, time::now(), time::now());

-- ===============================================
-- 为不同角色分配WebRTC权限
-- ===============================================

-- 管理员 (admin) - 拥有所有WebRTC权限
FOR $op_id IN [
    'webrtc_voice_call_initiate', 'webrtc_video_call_initiate', 'webrtc_call_answer', 'webrtc_call_reject', 'webrtc_call_end',
    'webrtc_camera_toggle', 'webrtc_microphone_toggle', 'webrtc_speaker_toggle', 'webrtc_screen_share',
    'webrtc_group_call_create', 'webrtc_group_call_join', 'webrtc_group_call_invite', 'webrtc_group_call_manage',
    'webrtc_file_send', 'webrtc_file_receive', 'webrtc_media_upload',
    'webrtc_message_send', 'webrtc_message_view', 'webrtc_message_delete',
    'webrtc_recording_start', 'webrtc_recording_stop', 'webrtc_quality_control', 'webrtc_network_monitor'
] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    IF $operation {
        RELATE role:admin->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
    };
};

-- 案件管理人 (case_manager) - 拥有大部分WebRTC权限，除了录制功能
FOR $op_id IN [
    'webrtc_voice_call_initiate', 'webrtc_video_call_initiate', 'webrtc_call_answer', 'webrtc_call_reject', 'webrtc_call_end',
    'webrtc_camera_toggle', 'webrtc_microphone_toggle', 'webrtc_speaker_toggle', 'webrtc_screen_share',
    'webrtc_group_call_create', 'webrtc_group_call_join', 'webrtc_group_call_invite', 'webrtc_group_call_manage',
    'webrtc_file_send', 'webrtc_file_receive', 'webrtc_media_upload',
    'webrtc_message_send', 'webrtc_message_view', 'webrtc_message_delete',
    'webrtc_quality_control', 'webrtc_network_monitor'
] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    IF $operation {
        RELATE role:case_manager->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
    };
};

-- 协办律师 (assistant_lawyer) - 拥有基础通话权限和群组功能
FOR $op_id IN [
    'webrtc_voice_call_initiate', 'webrtc_video_call_initiate', 'webrtc_call_answer', 'webrtc_call_reject', 'webrtc_call_end',
    'webrtc_camera_toggle', 'webrtc_microphone_toggle', 'webrtc_speaker_toggle', 'webrtc_screen_share',
    'webrtc_group_call_join', 'webrtc_group_call_invite',
    'webrtc_file_send', 'webrtc_file_receive', 'webrtc_media_upload',
    'webrtc_message_send', 'webrtc_message_view',
    'webrtc_quality_control', 'webrtc_network_monitor'
] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    IF $operation {
        RELATE role:assistant_lawyer->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
    };
};

-- 债权人代表 (creditor_representative) - 拥有基础通话权限
FOR $op_id IN [
    'webrtc_voice_call_initiate', 'webrtc_video_call_initiate', 'webrtc_call_answer', 'webrtc_call_reject', 'webrtc_call_end',
    'webrtc_camera_toggle', 'webrtc_microphone_toggle', 'webrtc_speaker_toggle',
    'webrtc_group_call_join',
    'webrtc_file_send', 'webrtc_file_receive', 'webrtc_media_upload',
    'webrtc_message_send', 'webrtc_message_view',
    'webrtc_network_monitor'
] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    IF $operation {
        RELATE role:creditor_representative->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
    };
};

-- 债权审核员 (claim_reviewer) - 拥有最基础的通话权限
FOR $op_id IN [
    'webrtc_voice_call_initiate', 'webrtc_video_call_initiate', 'webrtc_call_answer', 'webrtc_call_reject', 'webrtc_call_end',
    'webrtc_camera_toggle', 'webrtc_microphone_toggle', 'webrtc_speaker_toggle',
    'webrtc_message_send', 'webrtc_message_view',
    'webrtc_network_monitor'
] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    IF $operation {
        RELATE role:claim_reviewer->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
    };
};

-- ===============================================
-- 验证权限设置
-- ===============================================

-- 查询验证：显示所有WebRTC相关权限
SELECT 
    r.name as role_name,
    op.operation_id,
    op.operation_name,
    op.description,
    ceo.can_execute
FROM role r
->can_execute_operation ceo
->operation_metadata op
WHERE op.operation_id LIKE 'webrtc_%'
ORDER BY r.name, op.operation_id;

-- 提示信息
SELECT 'WebRTC权限系统集成完成' as status, time::now() as completed_at;