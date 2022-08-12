import notification from '@/components/notification';
import type { WidgetProps } from '@/components/scaffolds/task';
import {
	BasicCheckbox,
	BasicInputNumber,
	ChannelAutoComplete,
	IndexAutoComplete,
	IndexTypeAutoComplete,
	RestoreColumnSelect,
	SpeedAutoComplete,
	TableSelectWithCreateButton,
} from '@/components/scaffolds/task';
import {
	BasicInput,
	BasicRadio,
	BasicSelect,
	BasicTextArea,
	DataSourceSelect,
	EncodingSelect,
	ExtralConfigTextarea,
	IncreColumnSelect,
	IndexSelect,
	IndexTypeSelect,
	PartitionComplete,
	PathInput,
	SchemaSelect,
	SplitSelect,
	TableMultiSelect,
	TableSingleSelect,
	WhereTextarea,
} from '@/components/scaffolds/task';
import { BINARY_ROW_KEY_FLAG, DATA_SYNC_MODE, formItemLayout } from '@/constant';
import taskSaveService from '@/services/taskSaveService';
import { CaretRightOutlined } from '@ant-design/icons';
import molecule from '@dtinsight/molecule';
import type { FormItemProps } from 'antd';
import { Collapse, Form, Spin } from 'antd';
import { get } from 'lodash';
import { useEffect } from 'react';
import KeyMap from './keymap';
import './index.scss';

interface IJSSSS {
	type: 'object';
	properties: {
		type: string;
		key: string;
		title: string;
		widget?: string;
		/**
		 * ONLY works on basic widget
		 */
		required?: boolean;
		/**
		 * ONLY works on basic widget
		 */
		initialValue?: string | number;
		properties?: IJSSSS['properties'];
		visibility?: { field: string; value?: string }[];
		props?: Record<string, any>;
	}[];
}

const mockJson: IJSSSS = {
	type: 'object',
	properties: [
		{
			type: 'object',
			key: 'sourceMap',
			title: '选择来源',
			properties: [
				{
					type: 'number',
					key: 'sourceId',
					title: '数据源',
					widget: 'DataSource',
					props: {},
				},
				{
					type: 'string',
					key: 'schema',
					title: 'Schema',
					widget: 'SchemaSelect',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '2,4',
						},
					],
				},
				{
					type: 'string',
					key: 'table',
					title: '表名（批量）',
					widget: 'TableMulti',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '1,3',
						},
						{
							field: 'global.increment',
							value: 'false',
						},
					],
				},
				{
					type: 'string',
					key: 'table',
					title: '表名',
					widget: 'TableSingle',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '1,3',
						},
						{
							field: 'global.increment',
							value: 'true',
						},
					],
				},
				{
					type: 'string',
					key: 'table',
					title: '表名',
					widget: 'TableSingle',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '2,4,7,8,27,45,50',
						},
					],
				},
				{
					type: 'string',
					key: 'increColumn',
					title: '增量标识字段',
					widget: 'IncreColumnSelect',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '1,2,3,4',
						},
						{
							field: 'global.increment',
							value: 'true',
						},
					],
				},
				{
					type: 'string',
					key: 'encoding',
					title: '编码',
					widget: 'EncodingSelect',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'startRowkey',
					title: '开始行健',
					widget: 'Input',
					props: {
						placeholder: '请输入开始行健',
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'endRowkey',
					title: '结束行健',
					widget: 'Input',
					props: {
						placeholder: '请输入结束行健',
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'isBinaryRowkey',
					title: '行健二进制转换',
					widget: 'Radio',
					props: {
						options: [
							{
								label: 'FALSE',
								value: BINARY_ROW_KEY_FLAG.FALSE,
							},
							{
								label: 'TRUE',
								value: BINARY_ROW_KEY_FLAG.TRUE,
							},
						],
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'scanCacheSize',
					title: '每次RPC请求获取行数',
					widget: 'Input',
					props: {
						placeholder: '请输入大小，默认为 256',
						type: 'number',
						min: 0,
						suffix: '行',
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'scanBatchSize',
					title: '每次RPC请求获取列数',
					widget: 'Input',
					props: {
						placeholder: '请输入大小，默认为 100',
						type: 'number',
						min: 0,
						suffix: '列',
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'where',
					title: '数据过滤',
					widget: 'WhereTextarea',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '1,2,3,4',
						},
					],
				},
				{
					type: 'string',
					key: 'splitPK',
					title: '切分键',
					widget: 'SplitSelect',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '1,2,3,4',
						},
					],
				},
				{
					type: 'string',
					key: 'path',
					title: '路径',
					widget: 'PathInput',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '6',
						},
					],
				},
				{
					type: 'string',
					key: 'fileType',
					title: '文件类型',
					widget: 'Select',
					required: true,
					initialValue: 'text',
					props: {
						placeholder: '请选择文件类型',
						options: [
							{ label: 'orc', value: 'orc' },
							{ label: 'text', value: 'text' },
							{ label: 'parquet', value: 'parquet' },
						],
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '6',
						},
					],
				},
				{
					type: 'string',
					key: 'fieldDelimiter',
					title: '列分隔符',
					widget: 'Input',
					props: {
						placeholder: '若不填写，则默认为\\001',
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '6',
						},
						{
							field: 'sourceMap.fileType',
							value: 'text',
						},
					],
				},
				{
					type: 'string',
					key: 'encoding',
					title: '编码',
					widget: 'Select',
					required: true,
					initialValue: 'utf-8',
					props: {
						placeholder: '请选择编码',
						options: [
							{
								label: 'utf-8',
								value: 'utf-8',
							},
							{
								label: 'gbk',
								value: 'gbk',
							},
						],
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '6',
						},
						{
							field: 'sourceMap.fileType',
							value: 'text',
						},
					],
				},
				{
					type: 'string',
					key: 'partition',
					title: '分区',
					widget: 'PartitionComplete',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '7,27,45,50',
						},
					],
				},
				{
					type: 'string',
					key: 'index',
					title: 'index',
					widget: 'IndexSelect',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '11,33,46',
						},
					],
				},
				{
					type: 'string',
					key: 'indexType',
					title: 'type',
					widget: 'IndexTypeSelect',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '11,33',
						},
					],
				},
				{
					type: 'string',
					key: 'query',
					title: 'query',
					widget: 'Textarea',
					props: {
						placeholder: '"match_all":{}',
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '11,33,46',
						},
					],
				},
				{
					type: 'string',
					key: 'extralConfig',
					title: '高级配置',
					widget: 'textarea',
					visibility: [
						{
							field: 'sourceMap.sourceId',
						},
					],
				},
			],
		},
		{
			type: 'object',
			key: 'targetMap',
			title: '选择目标',
			properties: [
				{
					type: 'number',
					key: 'sourceId',
					title: '数据同步目标',
					widget: 'DataSource',
					props: {},
				},
				{
					type: 'string',
					key: 'schema',
					title: 'Schema',
					widget: 'SchemaSelect',
					visibility: [
						{
							field: 'sourceMap.type',
							value: '2,4',
						},
					],
				},
				{
					type: 'string',
					key: 'table',
					title: '表名',
					widget: 'TableSelectWithCreateButton',
					visibility: [
						{
							field: 'targetMap.type',
							value: '1,2,3,4,7,27,45,50',
						},
					],
				},
				{
					type: 'string',
					key: 'table',
					title: '表名',
					widget: 'TableSingle',
					visibility: [
						{
							field: 'targetMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'partition',
					title: '分区',
					widget: 'PartitionComplete',
					required: true,
					props: {
						showFieldByData: true,
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '7,27,45,50',
						},
					],
				},
				{
					type: 'string',
					key: 'writeMode',
					title: '写入模式',
					widget: 'Radio',
					required: true,
					initialValue: 'replace',
					props: {
						options: [
							{
								label: '覆盖（Insert Overwrite）',
								value: 'replace',
							},
							{
								label: '追加（Insert Into）',
								value: 'insert',
							},
						],
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '7,27,45,50',
						},
					],
				},
				{
					type: 'string',
					key: 'preSql',
					title: '导入前准备语句',
					widget: 'Textarea',
					props: {
						placeholder: '请输入导入数据前执行的 SQL 脚本',
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '1,2,3,4',
						},
					],
				},
				{
					type: 'string',
					key: 'postSql',
					title: '导入后准备语句',
					widget: 'Textarea',
					props: {
						placeholder: '请输入导入数据后执行的 SQL 脚本',
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '1,2,3,4',
						},
					],
				},
				{
					type: 'string',
					key: 'writeMode',
					title: '主键冲突',
					widget: 'Select',
					required: true,
					initialValue: 'insert',
					props: {
						placeholder: '请选择主键冲突模式',
						options: [
							{
								label: 'insert into（当主键/约束冲突，报脏数据）',
								value: 'insert',
							},
							{
								label: 'replace into（当主键/约束冲突，先 delete 再 insert ，未映射的字段会被映射为 NULL）',
								value: 'replace',
							},
							{
								label: 'on duplicate key update（当主键/约束冲突，update 数据，未映射的字段值不变）',
								value: 'update',
							},
						],
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '1,3',
						},
					],
				},
				{
					type: 'string',
					key: 'writeMode',
					title: '主键冲突',
					widget: 'Select',
					required: true,
					initialValue: 'insert',
					props: {
						placeholder: '请选择主键冲突模式',
						options: [
							{
								label: 'insert into（当主键/约束冲突，报脏数据）',
								value: 'insert',
							},
						],
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '2,4',
						},
					],
				},
				{
					type: 'string',
					key: 'path',
					title: '路径',
					widget: 'Input',
					required: true,
					props: {
						placeholder: '例如: /app/batch',
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '6',
						},
					],
				},
				{
					type: 'string',
					key: 'fileName',
					title: '文件名',
					widget: 'Input',
					required: true,
					props: {
						placeholder: '请输入文件名',
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '6',
						},
					],
				},
				{
					type: 'string',
					key: 'fileType',
					title: '文件类型',
					widget: 'Select',
					required: true,
					initialValue: 'orc',
					props: {
						placeholder: '请选择文件类型',
						options: [
							{ label: 'orc', value: 'orc' },
							{ label: 'text', value: 'text' },
							{ label: 'parquet', value: 'parquet' },
						],
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '6',
						},
					],
				},
				{
					type: 'string',
					key: 'fieldDelimiter',
					title: '列分隔符',
					widget: 'Input',
					props: {
						placeholder: '例如: 目标为 hive 则分隔符为\\001',
					},
					initialValue: ',',
					visibility: [
						{
							field: 'targetMap.type',
							value: '6',
						},
					],
				},
				{
					type: 'string',
					key: 'encoding',
					title: '编码',
					widget: 'Select',
					required: true,
					initialValue: 'utf-8',
					props: {
						placeholder: '请选择编码',
						options: [
							{
								label: 'utf-8',
								value: 'utf-8',
							},
							{
								label: 'gbk',
								value: 'gbk',
							},
						],
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '6,8',
						},
					],
				},
				{
					type: 'string',
					key: 'writeMode',
					title: '写入模式',
					widget: 'Radio',
					required: true,
					initialValue: 'APPEND',
					props: {
						placeholder: '请选择写入模式',
						options: [
							{
								label: '覆盖（Insert Overwrite）',
								value: 'NONCONFLICT',
							},
							{
								label: '追加（Insert Into）',
								value: 'APPEND',
							},
						],
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '6',
						},
					],
				},
				{
					type: 'string',
					key: 'nullMode',
					title: '读取为空时的处理方式',
					widget: 'Radio',
					required: true,
					initialValue: 'skip',
					props: {
						options: [
							{
								label: 'SKIP',
								value: 'skip',
							},
							{
								label: 'EMPTY',
								value: 'empty',
							},
						],
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'writeBufferSize',
					title: '写入缓存大小',
					widget: 'InputNumber',
					props: {
						placeholder: '请输入缓存大小',
						suffix: 'KB',
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '8',
						},
					],
				},
				{
					type: 'string',
					key: 'index',
					title: 'index',
					widget: 'IndexAutoComplete',
					visibility: [
						{
							field: 'targetMap.type',
							value: '11,33,46',
						},
					],
				},
				{
					type: 'string',
					key: 'indexType',
					title: 'type',
					widget: 'IndexTypeAutoComplete',
					visibility: [
						{
							field: 'targetMap.type',
							value: '11,33',
						},
					],
				},
				{
					type: 'number',
					key: 'bulkAction',
					title: 'bulkAction',
					widget: 'InputNumber',
					initialValue: 100,
					required: true,
					props: {
						min: 1,
						max: 200000,
						precision: 0,
						placeholder: '请输入 bulkAction',
					},
					visibility: [
						{
							field: 'targetMap.type',
							value: '11,33,46',
						},
					],
				},
				{
					type: 'string',
					key: 'extralConfig',
					title: '高级配置',
					widget: 'textarea',
					visibility: [
						{
							field: 'targetMap.sourceId',
						},
					],
				},
			],
		},
		{
			type: 'object',
			key: 'keyMap',
			title: '字段映射',
			properties: [
				{
					type: 'object',
					key: 'sourceMap',
					title: '字段映射',
					widget: 'KeyMap',
				},
			],
		},
		{
			type: 'object',
			key: 'settingMap',
			title: '通道控制',
			properties: [
				{
					type: 'string',
					key: 'speed',
					title: '作业速率上限',
					widget: 'SpeedAutoComplete',
					initialValue: '不限制传输速率',
				},
				{
					type: 'string',
					key: 'channel',
					title: '作业并发数',
					widget: 'ChannelAutoComplete',
					initialValue: '1',
				},
				{
					type: 'boolean',
					key: 'isRestore',
					title: '断点续传',
					widget: 'Checkbox',
					props: {
						children: '开启',
					},
					visibility: [
						{
							field: 'sourceMap.type',
							value: '1,2,3,4,8,19,22,24,25,28,29,31,32,35,36,40,53,54,61,71,73',
						},
						{
							field: 'targetMap.type',
							value: '1,2,3,4,7,8,10,19,22,24,25,27,28,29,31,32,35,36,40,53,54,61,71,73',
						},
					],
				},
				{
					type: 'string',
					key: 'restoreColumnName',
					title: '标识字段',
					widget: 'RestoreColumnSelect',
					visibility: [
						{
							field: 'settingMap.isRestore',
							value: 'true',
						},
					],
				},
			],
		},
	],
};

const templateRegistry: Record<string, (props: WidgetProps<any>) => JSX.Element | null> = {
	DataSource: DataSourceSelect,
	textarea: ExtralConfigTextarea,
	TableMulti: TableMultiSelect,
	TableSingle: TableSingleSelect,
	WhereTextarea,
	SplitSelect,
	IncreColumnSelect,
	SchemaSelect,
	EncodingSelect,
	PathInput,
	PartitionComplete,
	IndexSelect,
	IndexTypeSelect,
	TableSelectWithCreateButton,
	IndexAutoComplete,
	IndexTypeAutoComplete,
	KeyMap,
	SpeedAutoComplete,
	ChannelAutoComplete,
	RestoreColumnSelect,
	Input: BasicInput,
	InputNumber: BasicInputNumber,
	Textarea: BasicTextArea,
	Radio: BasicRadio,
	Select: BasicSelect,
	Checkbox: BasicCheckbox,
};

export default function DataSync() {
	const [form] = Form.useForm();
	const sourceMap = Form.useWatch('sourceMap', form);
	const targetMap = Form.useWatch('targetMap', form);
	const settingMap = Form.useWatch('settingMap', form);

	useEffect(() => {
		if (sourceMap && settingMap && targetMap) {
			console.log(sourceMap, settingMap, targetMap);
		}
	}, [sourceMap, settingMap, targetMap]);

	const globalVariables = {
		increment:
			molecule.editor.getState().current?.tab?.data?.sourceMap?.syncModel ===
			DATA_SYNC_MODE.INCREMENT,
	};

	const renderFormContent = () => {
		return mockJson.properties.map((property) => {
			return (
				<Collapse
					className="taier__dataSync__collapse"
					bordered={false}
					defaultActiveKey={[property.key]}
					expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
					key={property.key}
				>
					<Collapse.Panel header={property.title} key={property.key}>
						{property.properties?.map((subProperty, idx) => {
							const Component = templateRegistry[`${subProperty.widget}`];
							if (!Component) {
								notification.error({
									key: 'UNDEFINED_WIDGET',
									message: `未知 Widget: ${subProperty.widget}`,
								});
								return null;
							}

							return (
								<Form.Item
									noStyle
									key={idx}
									dependencies={
										subProperty.visibility
											?.map((i) => i.field.split('.'))
											.filter((i) => i[0] !== 'global') || []
									}
								>
									{({ getFieldsValue }) => {
										const forms = getFieldsValue();
										const isVisible = (subProperty.visibility || []).reduce(
											(visible, condition) => {
												if (!visible) return false;
												const formVal = get(
													condition.field.startsWith('global')
														? { global: globalVariables }
														: forms,
													condition.field,
												);
												if (condition.value) {
													if (condition.value.includes(',')) {
														return condition.value
															.split(',')
															.includes(`${formVal}`);
													}

													// 字符串相等
													return `${condition.value}` === `${formVal}`;
												}

												return !!formVal;
											},
											true,
										);

										const formProps: FormItemProps = {
											name: [property.key, subProperty.key],
											label: subProperty.title,
										};

										// ONLY pass through to Component when these values are truly
										if (subProperty.required !== undefined) {
											formProps.required = subProperty.required;
										}
										if (subProperty.initialValue !== undefined) {
											formProps.initialValue = subProperty.initialValue;
										}

										return (
											isVisible && (
												<Component
													formProps={formProps}
													{...subProperty.props}
												/>
											)
										);
									}}
								</Form.Item>
							);
						})}
					</Collapse.Panel>
				</Collapse>
			);
		});
	};

	useEffect(() => {
		taskSaveService.onSaveSyncTask((callback) => {
			callback(form.validateFields());
		});
	}, []);

	return (
		<div className="taier__dataSync__container">
			<Spin spinning={false}>
				<Form form={form} {...formItemLayout}>
					{renderFormContent()}
				</Form>
			</Spin>
		</div>
	);
}
