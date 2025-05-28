import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    FormHelperText,
    Box,
} from '@mui/material';

export interface AdminBasicClaimData {
    // Creditor Info
    creditorCategory: '组织' | '个人' | '';
    creditorName: string;
    creditorIdentifier: string;
    // Contact Info
    contactPersonName: string;
    contactInfo: string;
    // Asserted Claim Info
    claimNature: string;
    currency: string;
    principal: string; // Stored as string for form input, convert to number on save
    interest?: string;
    otherFees?: string;
}

interface AdminCreateClaimBasicInfoDialogProps {
    open: boolean;
    onClose: () => void;
    onNext: (data: AdminBasicClaimData) => void;
}

const AdminCreateClaimBasicInfoDialog: React.FC<AdminCreateClaimBasicInfoDialogProps> = ({
                                                                                             open,
                                                                                             onClose,
                                                                                             onNext,
                                                                                         }) => {
    const { t } = useTranslation();

    const initialFormData: AdminBasicClaimData = {
        creditorCategory: '',
        creditorName: '',
        creditorIdentifier: '',
        contactPersonName: '',
        contactInfo: '',
        claimNature: '',
        currency: 'CNY',
        principal: '',
        interest: '',
        otherFees: '',
    };

    const [formData, setFormData] = useState<AdminBasicClaimData>(initialFormData);
    const [errors, setErrors] = useState<Partial<Record<keyof AdminBasicClaimData, string>>>({});

    useEffect(() => {
        if (open) {
            setFormData(initialFormData);
            setErrors({});
        }
    }, [open]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name as string]: value }));
        if (errors[name as keyof AdminBasicClaimData]) {
            setErrors(prev => ({ ...prev, [name as keyof AdminBasicClaimData]: undefined }));
        }
    };

    const handleSelectChange = (event: any) => { // Using 'any' for SelectChangeEvent for simplicity here
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name as string]: value as string }));
        if (errors[name as keyof AdminBasicClaimData]) {
            setErrors(prev => ({ ...prev, [name as keyof AdminBasicClaimData]: undefined }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof AdminBasicClaimData, string>> = {};
        if (!formData.creditorCategory) newErrors.creditorCategory = t('validation_required_creditor_category', '债权人类别不能为空');
        if (!formData.creditorName.trim()) newErrors.creditorName = t('validation_required_creditor_name', '债权人名称不能为空');
        if (!formData.creditorIdentifier.trim()) newErrors.creditorIdentifier = t('validation_required_creditor_id', '债权人ID不能为空');
        if (!formData.contactPersonName.trim()) newErrors.contactPersonName = t('validation_required_contact_name', '联系人姓名不能为空');
        if (!formData.contactInfo.trim()) newErrors.contactInfo = t('validation_required_contact_info', '联系方式不能为空');
        if (!formData.claimNature) newErrors.claimNature = t('validation_required_claim_nature', '债权性质不能为空');
        if (!formData.currency) newErrors.currency = t('validation_required_currency', '币种不能为空');
        if (!formData.principal.trim()) {
            newErrors.principal = t('validation_required_principal', '本金不能为空');
        } else if (isNaN(parseFloat(formData.principal)) || parseFloat(formData.principal) <= 0) {
            newErrors.principal = t('validation_invalid_principal', '本金必须为正数');
        }
        if (formData.interest && isNaN(parseFloat(formData.interest))) newErrors.interest = t('validation_invalid_interest', '利息必须是有效数字');
        if (formData.otherFees && isNaN(parseFloat(formData.otherFees))) newErrors.otherFees = t('validation_invalid_other_fees', '其他费用必须是有效数字');

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validate()) {
            onNext(formData);
        }
    };

    const creditorIdLabel = formData.creditorCategory === '组织'
        ? t('creditor_form_identifier_org_label', '统一社会信用代码')
        : t('creditor_form_identifier_individual_label', '身份证号');

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('admin_create_claim_title', '创建债权 (管理员代报) - 基本信息')}</DialogTitle>
            <DialogContent dividers>
                <Box component="form" noValidate autoComplete="off">
                    <Typography variant="h6" gutterBottom sx={{mt:1, mb:2}}>{t('creditor_information_title', '债权人信息')}</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth error={!!errors.creditorCategory}>
                                <InputLabel id="creditorCategory-label">{t('creditor_form_category_label', '类别')}*</InputLabel>
                                <Select
                                    labelId="creditorCategory-label"
                                    name="creditorCategory"
                                    value={formData.creditorCategory}
                                    label={t('creditor_form_category_label', '类别') + "*"}
                                    onChange={handleSelectChange}
                                >
                                    <MenuItem value="组织">{t('creditor_category_organization', '组织')}</MenuItem>
                                    <MenuItem value="个人">{t('creditor_category_individual', '个人')}</MenuItem>
                                </Select>
                                {errors.creditorCategory && <FormHelperText>{errors.creditorCategory}</FormHelperText>}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                required
                                name="creditorName"
                                label={t('creditor_form_name_label', '姓名/名称')}
                                fullWidth
                                value={formData.creditorName}
                                onChange={handleChange}
                                error={!!errors.creditorName}
                                helperText={errors.creditorName}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                required
                                name="creditorIdentifier"
                                label={creditorIdLabel}
                                fullWidth
                                value={formData.creditorIdentifier}
                                onChange={handleChange}
                                error={!!errors.creditorIdentifier}
                                helperText={errors.creditorIdentifier}
                            />
                        </Grid>
                    </Grid>

                    <Typography variant="h6" gutterBottom sx={{mt:3, mb:2}}>{t('contact_information_title', '联系人信息')}</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                name="contactPersonName"
                                label={t('creditor_form_contact_person_name_label', '联系人姓名')}
                                fullWidth
                                value={formData.contactPersonName}
                                onChange={handleChange}
                                error={!!errors.contactPersonName}
                                helperText={errors.contactPersonName}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                required
                                name="contactInfo"
                                label={t('creditor_form_contact_info_label', '联系方式')}
                                fullWidth
                                value={formData.contactInfo}
                                onChange={handleChange}
                                error={!!errors.contactInfo}
                                helperText={errors.contactInfo}
                            />
                        </Grid>
                    </Grid>

                    <Typography variant="h6" gutterBottom sx={{mt:3, mb:2}}>{t('asserted_claim_information_title', '主张债权信息')}</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.claimNature}>
                                <InputLabel id="claimNature-label">{t('claim_form_nature_label', '债权性质')}*</InputLabel>
                                {/* // TODO: Fetch from admin config */}
                                <Select
                                    labelId="claimNature-label"
                                    name="claimNature"
                                    value={formData.claimNature}
                                    label={t('claim_form_nature_label', '债权性质') + "*"}
                                    onChange={handleSelectChange}
                                >
                                    <MenuItem value="货款">{t('claim_nature_goods_payment', '货款')}</MenuItem>
                                    <MenuItem value="服务费">{t('claim_nature_service_fee', '服务费')}</MenuItem>
                                    <MenuItem value="劳动报酬">{t('claim_nature_labor_remuneration', '劳动报酬')}</MenuItem>
                                    <MenuItem value="其他">{t('claim_nature_other', '其他')}</MenuItem>
                                </Select>
                                {errors.claimNature && <FormHelperText>{errors.claimNature}</FormHelperText>}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.currency}>
                                <InputLabel id="currency-label">{t('claim_form_currency_label', '币种')}*</InputLabel>
                                <Select
                                    labelId="currency-label"
                                    name="currency"
                                    value={formData.currency}
                                    label={t('claim_form_currency_label', '币种') + "*"}
                                    onChange={handleSelectChange}
                                >
                                    <MenuItem value="CNY">CNY</MenuItem>
                                    <MenuItem value="USD">USD</MenuItem>
                                </Select>
                                {errors.currency && <FormHelperText>{errors.currency}</FormHelperText>}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                required
                                name="principal"
                                label={t('claim_form_principal_label', '本金')}
                                type="number"
                                fullWidth
                                value={formData.principal}
                                onChange={handleChange}
                                error={!!errors.principal}
                                helperText={errors.principal}
                                InputProps={{ inputProps: { min: 0 } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                name="interest"
                                label={t('claim_form_interest_label', '利息')}
                                type="number"
                                fullWidth
                                value={formData.interest}
                                onChange={handleChange}
                                error={!!errors.interest}
                                helperText={errors.interest}
                                InputProps={{ inputProps: { min: 0 } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                name="otherFees"
                                label={t('claim_form_other_fees_label', '其他费用')}
                                type="number"
                                fullWidth
                                value={formData.otherFees}
                                onChange={handleChange}
                                error={!!errors.otherFees}
                                helperText={errors.otherFees}
                                InputProps={{ inputProps: { min: 0 } }}
                            />
                        </Grid>
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('cancel_button', '取消')}</Button>
                <Button onClick={handleNext} variant="contained">
                    {t('next_edit_attachments_button', '下一步 (编辑附件)')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AdminCreateClaimBasicInfoDialog;
