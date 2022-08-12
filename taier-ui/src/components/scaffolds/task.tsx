import { useEffect, useMemo, useState } from 'react';
import {
	AutoComplete,
	Checkbox,
	Empty,
	Form,
	Input,
	InputNumber,
	message,
	Modal,
	Radio,
	Select,
	Spin,
	Tooltip,
} from 'antd';
import api from '@/api';
import {
	DATA_SOURCE_ENUM,
	DATA_SOURCE_TEXT,
	DATA_SYNC_MODE,
	DDL_IDE_PLACEHOLDER,
	TASK_LANGUAGE,
} from '@/constant';
import { getTenantId } from '@/utils';
import { ConsoleSqlOutlined, LoadingOutlined } from '@ant-design/icons';
import Editor from '@/components/editor';
import type { IDataColumnsProps, IDataSourceUsedInSyncProps } from '@/interface';
import type { InputProps, TextAreaProps } from 'antd/lib/input';
import type {
	FormItemProps,
	SelectProps,
	RadioGroupProps,
	AutoCompleteProps,
	InputNumberProps,
} from 'antd';
import type { NamePath } from 'antd/lib/form/interface';
import type { CheckboxProps } from 'antd/lib/checkbox';

const { Option } = Select;

export type WidgetProps<T> = T & { formProps: FormItemProps };

function replaceLastItem(namePath: NamePath, val: string): NamePath {
	if (!Array.isArray(namePath)) return val;
	const next = [...namePath];
	next[next.length - 1] = val;
	return next;
}

function convertNamePathToNestedObj(name: NamePath, initialValue: any): Record<string, any> {
	if (!Array.isArray(name)) return { [name]: initialValue };

	return name.reduceRight(
		(pre, cur) => ({
			[cur]: pre,
		}),
		initialValue,
	);
}

/**
 * 基础 Textarea
 */
export function BasicTextArea({ formProps, ...restProps }: WidgetProps<TextAreaProps>) {
	const form = Form.useFormInstance();

	useEffect(() => {
		return () => {
			form.resetFields([formProps.name!]);
		};
	}, []);

	return (
		<Form.Item {...formProps}>
			<Input.TextArea {...restProps} />
		</Form.Item>
	);
}

/**
 * 基础 InputNumber
 */
export function BasicInputNumber({ formProps, ...restProps }: WidgetProps<InputNumberProps>) {
	const form = Form.useFormInstance();

	useEffect(() => {
		return () => {
			form.resetFields([formProps.name!]);
		};
	}, []);

	return (
		<Form.Item {...formProps}>
			<InputNumber min={0} style={{ width: '100%' }} {...restProps} />
		</Form.Item>
	);
}

/**
 * 基础 Input
 */
export function BasicInput({ formProps, ...restProps }: WidgetProps<InputProps>) {
	const form = Form.useFormInstance();

	useEffect(() => {
		return () => {
			form.resetFields([formProps.name!]);
		};
	}, []);

	return (
		<Form.Item {...formProps}>
			<Input {...restProps} />
		</Form.Item>
	);
}

/**
 * 基础 Select
 */
export function BasicSelect({ formProps, ...restProps }: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();

	useEffect(() => {
		return () => {
			form.resetFields([formProps.name!]);
		};
	}, []);

	return (
		<Form.Item {...formProps}>
			<Select
				getPopupContainer={(node) => node.parentNode}
				showSearch
				optionFilterProp="children"
				filterOption={(input, option) =>
					(option!.children as unknown as string)
						.toLowerCase()
						.includes(input.toLowerCase())
				}
				{...restProps}
			/>
		</Form.Item>
	);
}

/**
 * 基础 Radio 选择
 */
export function BasicRadio({ formProps, ...restProps }: WidgetProps<RadioGroupProps>) {
	const form = Form.useFormInstance();

	useEffect(() => {
		return () => {
			form.resetFields([formProps.name!]);
		};
	}, []);

	return (
		<Form.Item {...formProps}>
			<Radio.Group {...restProps} />
		</Form.Item>
	);
}

/**
 * 基础 CheckBox 组件
 */
export function BasicCheckbox({
	formProps,
	...restProps
}: WidgetProps<CheckboxProps & { children?: string }>) {
	const { children, ...checkboxProps } = restProps;
	return (
		<Form.Item valuePropName="checked" {...formProps}>
			<Checkbox {...checkboxProps}>{children}</Checkbox>
		</Form.Item>
	);
}

/**
 * 数据源下拉菜单
 */
export function DataSourceSelect({
	formProps: { label = '数据源', name = 'sourceId', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const [dataSource, setDataSource] = useState<IDataSourceUsedInSyncProps[]>([]);
	const [fetch, setFetching] = useState(false);

	useEffect(() => {
		setFetching(true);
		api.queryByTenantId<IDataSourceUsedInSyncProps[]>({ tenantId: getTenantId() })
			.then((res) => {
				if (res.code === 1) {
					setDataSource(res.data || []);
				}
			})
			.finally(() => {
				setFetching(false);
			});
	}, []);

	const typeNameField = useMemo(() => replaceLastItem(name, 'type'), [name]);

	return (
		<>
			<Form.Item name={typeNameField} hidden />
			<Form.Item
				name={name}
				label={label}
				rules={[
					{
						required: true,
						message: '数据源为必填项',
					},
				]}
				{...restFormProps}
			>
				<Select<number>
					getPopupContainer={(node) => node.parentNode}
					showSearch
					showArrow
					optionFilterProp="name"
					filterOption={(input, option) =>
						!!option?.label?.toLocaleString().includes(input.toLocaleLowerCase())
					}
					placeholder="请选择数据源"
					onChange={(sourceId) => {
						const type = dataSource.find(
							(i) => i.dataInfoId === sourceId,
						)?.dataTypeCode;
						form.setFieldsValue(convertNamePathToNestedObj(typeNameField, type));
					}}
					notFoundContent={
						fetch ? (
							<Spin size="small" />
						) : (
							<Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
						)
					}
					{...restProps}
				>
					{dataSource.map((src) => {
						// TODO: 后端获取 disabled 状态
						const disableSelect = false;
						const title = `${src.dataName}（${DATA_SOURCE_TEXT[src.dataTypeCode]}）`;

						return (
							<Option
								key={src.dataInfoId}
								name={src.dataName}
								value={src.dataInfoId}
								disabled={disableSelect}
							>
								{disableSelect ? (
									<Tooltip title="目前暂时不支持该数据源类型">{title}</Tooltip>
								) : (
									title
								)}
							</Option>
						);
					})}
				</Select>
			</Form.Item>
		</>
	);
}

/**
 * 高级配置
 */
export function ExtralConfigTextarea({
	formProps: { label = '高级配置', name = 'extralConfig', ...restFormProps },
	...restProps
}: WidgetProps<TextAreaProps>) {
	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					validator: (_, value: string) => {
						let msg = '';
						try {
							if (value) {
								const t = JSON.parse(value);
								if (typeof t !== 'object') {
									msg = '请填写正确的 JSON';
								}
							}
						} catch (e) {
							msg = '请检查 JSON 格式，确认无中英文符号混用！';
						}

						if (msg) {
							return Promise.reject(new Error(msg));
						}
						return Promise.resolve();
					},
				},
			]}
			{...restFormProps}
		>
			<Input.TextArea
				placeholder="以 JSON 格式添加高级参数，例如对关系型数据库可配置 fetchSize"
				autoSize={{ minRows: 2, maxRows: 6 }}
				{...restProps}
			/>
		</Form.Item>
	);
}

/**
 * 数据源 table 的多选下拉菜单
 * @dependencies sourceId
 */
export function TableMultiSelect({
	formProps: { label = '表名(批量)', name = 'table', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const schema = Form.useWatch(replaceLastItem(name, 'schema'), form);

	const [fetching, setFetching] = useState(false);
	const [tableList, setTableList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined) {
			setFetching(true);
			api.getOfflineTableList({
				sourceId,
				schema,
				isSys: false,
				// name: "",
				isRead: true,
			})
				.then((res) => {
					if (res.code === 1) {
						setTableList(res.data || []);
					}
				})
				.finally(() => {
					setFetching(false);
				});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, schema]);

	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					required: true,
					message: '数据源表为必选项！',
				},
			]}
			{...restFormProps}
		>
			<Select
				getPopupContainer={(container) => container.parentNode}
				mode="multiple"
				showSearch
				showArrow
				optionFilterProp="value"
				filterOption={(input, option) =>
					// @ts-ignore
					option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
				}
				placeholder="请选择表"
				notFoundContent={
					fetching ? (
						<Spin size="small" />
					) : (
						<Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
					)
				}
				{...restProps}
			>
				{tableList.map((table) => {
					return (
						<Option key={table} value={table}>
							{table}
						</Option>
					);
				})}
			</Select>
		</Form.Item>
	);
}

/**
 * 数据源 table 单选下拉
 * @dependencies sourceId
 */
export function TableSingleSelect({
	formProps: { label = '表名', name = 'table', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const schema = Form.useWatch(replaceLastItem(name, 'schema'), form);

	const [fetching, setFetching] = useState(false);
	const [tableList, setTableList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined) {
			setFetching(true);
			api.getOfflineTableList({
				sourceId,
				schema,
				isSys: false,
				// name: "",
				isRead: true,
			})
				.then((res) => {
					if (res.code === 1) {
						setTableList(res.data || []);
					}
				})
				.finally(() => {
					setFetching(false);
				});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, schema]);

	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					required: true,
					message: '数据源表为必选项！',
				},
			]}
			{...restFormProps}
		>
			<Select
				getPopupContainer={(container) => container.parentNode}
				showSearch
				showArrow
				optionFilterProp="value"
				filterOption={(input, option) =>
					// @ts-ignore
					option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
				}
				placeholder="请选择表"
				notFoundContent={
					fetching ? (
						<Spin size="small" />
					) : (
						<Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
					)
				}
				{...restProps}
			>
				{tableList.map((table) => {
					return (
						<Option key={table} value={table}>
							{table}
						</Option>
					);
				})}
			</Select>
		</Form.Item>
	);
}

/**
 * 带有一键创建目标表的 table 单选下拉
 */
export function TableSelectWithCreateButton({
	formProps: { label = '表名', name = 'table', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const schema = Form.useWatch(replaceLastItem(name, 'schema'), form);

	const [fetching, setFetching] = useState(false);
	const [tableList, setTableList] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [modalInfo, setModalInfo] = useState({ loading: false, visible: false });
	const [editorInfo, setEditorInfo] = useState({ textSql: '', sync: false });

	const getTableList = () => {
		setFetching(true);
		// reset current form value when sourceId changed
		form.setFieldValue(name, undefined);
		api.getOfflineTableList({
			sourceId,
			schema,
			isSys: false,
			// name: "",
			isRead: true,
		})
			.then((res) => {
				if (res.code === 1) {
					setTableList(res.data || []);
				}
			})
			.finally(() => {
				setFetching(false);
			});
	};

	const handleCreateTable = () => {
		setLoading(true);
		const originSourceId = form.getFieldValue(['sourceMap', 'sourceId']);
		const table = form.getFieldValue(['sourceMap', 'table']);
		const partition = form.getFieldValue(['sourceMap', 'partition']);
		const originSchema = form.getFieldValue(['sourceMap', 'schema']);

		const targetTableName = form.getFieldValue(name);

		api.getCreateTargetTable({
			originSourceId,
			tableName: Array.isArray(table) ? table[0] : table,
			partition,
			originSchema,
			targetSourceId: sourceId,
			targetSchema: schema || null,
		})
			.then((res) => {
				if (res.code === 1) {
					let textSql: string = res.data;
					if (targetTableName) {
						const reg = /create\s+table\s+`(.*)`\s*\(/i;
						textSql = textSql.replace(reg, (match, p1) =>
							match.replace(p1, targetTableName),
						);
					}
					setEditorInfo({
						textSql,
						sync: true,
					});
					setModalInfo({
						visible: true,
						loading: false,
					});
				}
			})
			.finally(() => {
				setLoading(false);
			});
	};

	const createTable = () => {
		setModalInfo({ loading: true, visible: true });
		api.createDdlTable({
			sql: editorInfo.textSql,
			sourceId,
		})
			.then((res) => {
				if (res.code === 1) {
					message.success('表创建成功!');
					getTableList();
					form.setFieldsValue(
						Array.isArray(name)
							? name.reduceRight(
									(cur, pre) => ({
										[pre]: cur,
									}),
									res.data,
							  )
							: { table: res.data },
					);
					setModalInfo((i) => ({ ...i, visible: false }));
				}
			})
			.finally(() => {
				setModalInfo((i) => ({ ...i, loading: false }));
			});
	};

	useEffect(() => {
		if (sourceId !== undefined) {
			getTableList();

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, schema]);

	return (
		<>
			<Form.Item
				label={label}
				name={name}
				rules={[
					{
						required: true,
						message: '数据源表为必选项！',
					},
				]}
				{...restFormProps}
			>
				<Select
					getPopupContainer={(container) => container.parentNode}
					showSearch
					showArrow
					optionFilterProp="value"
					filterOption={(input, option) =>
						// @ts-ignore
						option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
					}
					placeholder="请选择表"
					notFoundContent={
						fetching ? (
							<Spin size="small" />
						) : (
							<Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
						)
					}
					suffixIcon={
						<Tooltip title="一键生成目标表">
							{loading ? (
								<LoadingOutlined />
							) : (
								<ConsoleSqlOutlined onClick={handleCreateTable} />
							)}
						</Tooltip>
					}
					{...restProps}
				>
					{tableList.map((table) => {
						return (
							<Option key={table} value={table}>
								{table}
							</Option>
						);
					})}
				</Select>
			</Form.Item>
			<Modal
				title="建表语句"
				confirmLoading={modalInfo.loading}
				destroyOnClose
				maskClosable={false}
				style={{ height: 424 }}
				width={500}
				visible={modalInfo.visible}
				onCancel={() => setModalInfo({ visible: false, loading: false })}
				onOk={createTable}
			>
				<Editor
					style={{ height: 400, marginTop: 1 }}
					language={TASK_LANGUAGE.MYSQL}
					value={editorInfo.textSql}
					sync={editorInfo.sync}
					placeholder={DDL_IDE_PLACEHOLDER}
					options={{
						minimap: { enabled: false },
					}}
					onChange={(val) =>
						setEditorInfo({
							textSql: val,
							sync: false,
						})
					}
				/>
			</Modal>
		</>
	);
}

/**
 * 数据过滤字段
 */
export function WhereTextarea({
	formProps: { label = '数据过滤', name = 'where', ...restFormProps },
	...restProps
}: WidgetProps<TextAreaProps>) {
	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					max: 1000,
					message: '过滤语句不可超过 1000 个字符!',
				},
				{
					validator: (_, value) => {
						if (!/(‘|’|”|“)/.test(value)) {
							return Promise.resolve();
						}
						return Promise.reject(new Error('当前输入含有中文引号'));
					},
				},
			]}
			{...restFormProps}
		>
			<Input.TextArea
				placeholder="请参考相关 SQL 语法填写 where 过滤语句（不要填写 where 关键字）。该过滤语句通常用作增量同步"
				{...restProps}
			/>
		</Form.Item>
	);
}

/**
 * 切分键下拉菜单
 * @dependencies sourceId | table
 */
export function SplitSelect({
	formProps: { label = '切分键', name = 'splitPK', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const table = Form.useWatch(replaceLastItem(name, 'table'), form);
	const schema = Form.useWatch(replaceLastItem(name, 'schema'), form);

	const [splitPkList, setList] = useState<IDataColumnsProps[]>([]);

	useEffect(() => {
		if (table !== undefined && sourceId !== undefined) {
			api.getOfflineColumnForSyncopate({
				sourceId,
				tableName: Array.isArray(table) ? table[0] : table,
				schema,
			}).then((res) => {
				if (res.code === 1) {
					setList(res.data || []);
				}
			});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, table, schema]);

	return (
		<Form.Item label={label} name={name} {...restFormProps}>
			<Select
				getPopupContainer={(container) => container.parentNode}
				showSearch
				showArrow
				allowClear
				optionFilterProp="value"
				filterOption={(input, option) =>
					!!option?.label?.toString().includes(input.toLocaleLowerCase())
				}
				placeholder="请选择切分键"
				{...restProps}
			>
				{splitPkList.map((split) => {
					return (
						<Option key={split.key} value={split.key}>
							{split.key === 'ROW_NUMBER()' ? 'ROW_NUMBER' : split.key}
						</Option>
					);
				})}
			</Select>
		</Form.Item>
	);
}

/**
 * 增量标识字段
 * @dependencies sourceId | table
 */
export function IncreColumnSelect({
	formProps: { label = '增量标识字段', name = 'increColumn', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const table = Form.useWatch(replaceLastItem(name, 'table'), form);
	const schema = Form.useWatch(replaceLastItem(name, 'schema'), form);
	const [columns, setColumns] = useState<IDataColumnsProps[]>([]);

	useEffect(() => {
		const tableName = Array.isArray(table) ? table[0] : table;
		if (sourceId !== undefined && tableName !== undefined) {
			api.getIncrementColumns({
				sourceId,
				tableName,
				schema,
			}).then((res) => {
				setColumns(res.data || []);
			});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, table, schema]);

	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					required: true,
					message: '必须选择增量标识字段！',
				},
			]}
			{...restFormProps}
		>
			<Select
				getPopupContainer={(container) => container.parentNode}
				placeholder="请选择增量标识字段"
				showSearch
				optionFilterProp="children"
				filterOption={(input, option) =>
					(option!.children as unknown as string)
						.toLowerCase()
						.includes(input.toLowerCase())
				}
				{...restProps}
			>
				{columns.map((c) => (
					<Option key={c.key} value={c.key}>
						{c.key}
					</Option>
				))}
			</Select>
		</Form.Item>
	);
}

/**
 * Schema 字段
 * @dependencies sourceId
 */
export function SchemaSelect({
	formProps: { label = 'schema', name = 'schema', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);

	const [schemaList, setSchemaList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined) {
			api.getAllSchemas({
				sourceId,
				// schema,
			}).then((res) => {
				if (res.code === 1) {
					setSchemaList(res.data || []);
				}
			});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId]);

	return (
		<Form.Item label={label} name={name} {...restFormProps}>
			<Select
				getPopupContainer={(container) => container.parentNode}
				placeholder="请选择 Schema"
				showSearch
				optionFilterProp="children"
				filterOption={(input, option) =>
					(option!.children as unknown as string)
						.toLowerCase()
						.includes(input.toLowerCase())
				}
				{...restProps}
			>
				{schemaList.map((schema) => {
					return (
						<Option key={schema} value={schema}>
							{/* ORACLE数据库单独考虑ROW_NUMBER() 这个函数， 展示去除括号 */}
							{schema === 'ROW_NUMBER()' ? 'ROW_NUMBER' : schema}
						</Option>
					);
				})}
			</Select>
		</Form.Item>
	);
}

/**
 * 编码字段
 */
export function EncodingSelect({
	formProps: { label = '编码', name = 'encoding', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	return (
		<Form.Item name={name} label={label} required initialValue="utf-8" {...restFormProps}>
			<Select
				getPopupContainer={(container) => container.parentNode}
				showSearch
				optionFilterProp="children"
				filterOption={(input, option) =>
					(option!.children as unknown as string)
						.toLowerCase()
						.includes(input.toLowerCase())
				}
				{...restProps}
			>
				<Option value="utf-8">utf-8</Option>
				<Option value="gbk">gbk</Option>
			</Select>
		</Form.Item>
	);
}

/**
 * 路径字段
 */
export function PathInput({
	formProps: { label = '路径', name = 'path', ...restFormProps },
	...restProps
}: WidgetProps<InputProps>) {
	const form = Form.useFormInstance();

	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					required: true,
					message: '路径不得为空！',
				},
				{
					max: 200,
					message: '路径不得超过200个字符！',
				},
				{
					validator: (_: any, value: string) => {
						const { getFieldValue } = form;
						const sourceId = getFieldValue('sourceId');
						if (getFieldValue('fileType') === 'orc') {
							return api
								.getOfflineTableColumn({
									sourceId,
									tableName: value,
								})
								.then((res) => {
									if (res.code === 1) {
										return Promise.resolve();
									}
									return Promise.reject(new Error('该路径无效！'));
								});
						}

						return Promise.resolve();
					},
				},
			]}
			validateTrigger="onSubmit"
			{...restFormProps}
		>
			<Input placeholder="例如: /rdos/batch" {...restProps} />
		</Form.Item>
	);
}

/**
 * 分区字段
 * @dependencies sourceId | table
 * @param showFieldByData 是否根据分区的查询结果展示分区字段
 */
export function PartitionComplete({
	formProps: { label = '分区', name = 'partition', ...restFormProps },
	...restProps
}: WidgetProps<AutoCompleteProps & { showFieldByData?: boolean }>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const table = Form.useWatch(replaceLastItem(name, 'table'), form);

	const [tablePartitionList, setList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined && table !== undefined) {
			form.setFieldValue(name, undefined);

			api.getHivePartitionsForDataSource({
				sourceId,
				tableName: table,
			}).then((res) => {
				setList(res.data || []);
			});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, table]);

	const { showFieldByData, ...restAutoProps } = restProps;
	// 是否根据分区的查询结果展示分区字段
	const isShow = showFieldByData ? tablePartitionList.length : true;

	return isShow ? (
		<Form.Item label={label} name={name} {...restFormProps}>
			<AutoComplete
				getPopupContainer={(container) => container.parentNode}
				showSearch
				showArrow
				placeholder="请填写分区信息"
				filterOption={(input: any, option: any) => {
					return option.props.value.toLowerCase().indexOf(input.toLowerCase()) >= 0;
				}}
				{...restAutoProps}
			>
				{tablePartitionList.map((pt) => {
					return (
						<AutoComplete.Option key={`rdb-${pt}`} value={pt}>
							{pt}
						</AutoComplete.Option>
					);
				})}
			</AutoComplete>
		</Form.Item>
	) : null;
}

/**
 * Index 字段
 * @dependencies sourceId
 */
export function IndexSelect({
	formProps: { label = 'index', name = 'index', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);

	const [schemaList, setSchemaList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined) {
			form.setFieldValue(name, undefined);

			api.getAllSchemas({
				sourceId,
				// schema,
			}).then((res) => {
				if (res.code === 1) {
					setSchemaList(res.data || []);
				}
			});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId]);

	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					required: true,
					message: '请选择 index！',
				},
			]}
			{...restFormProps}
		>
			<Select
				getPopupContainer={(container) => container.parentNode}
				placeholder="请选择 index"
				showSearch
				optionFilterProp="children"
				filterOption={(input, option) =>
					(option!.children as unknown as string)
						.toLowerCase()
						.includes(input.toLowerCase())
				}
				{...restProps}
			>
				{schemaList.map((schema) => {
					return (
						<Option key={schema} value={schema}>
							{schema}
						</Option>
					);
				})}
			</Select>
		</Form.Item>
	);
}

/**
 * IndexType 字段
 * @dependencies sourceId | index
 */
export function IndexTypeSelect({
	formProps: { label = 'type', name = 'indexType', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const index = Form.useWatch(replaceLastItem(name, 'index'), form);

	const [fetching, setFetching] = useState(false);
	const [tableList, setTableList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined && index !== undefined) {
			setFetching(true);
			// reset current form value when sourceId changed
			form.setFieldValue(name, undefined);

			api.getOfflineTableList({
				sourceId,
				schema: index,
				isSys: false,
				// name: "",
				isRead: true,
			})
				.then((res) => {
					if (res.code === 1) {
						setTableList(res.data || []);
					}
				})
				.finally(() => {
					setFetching(false);
				});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, index]);

	return (
		<Form.Item
			label={label}
			name={name}
			rules={[
				{
					required: true,
					message: '请选择 indexType！',
				},
			]}
			{...restFormProps}
		>
			<Select
				getPopupContainer={(container) => container.parentNode}
				showSearch
				showArrow
				optionFilterProp="value"
				filterOption={(input, option) =>
					// @ts-ignore
					option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
				}
				placeholder="请选择 indexType！"
				notFoundContent={
					fetching ? (
						<Spin size="small" />
					) : (
						<Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
					)
				}
				{...restProps}
			>
				{tableList.map((table) => {
					return (
						<Option key={table} value={table}>
							{table}
						</Option>
					);
				})}
			</Select>
		</Form.Item>
	);
}

/**
 * Index 字段的自动补全组件
 * @dependencies sourceId
 */
export function IndexAutoComplete({
	formProps: { label = 'index', name = 'index', ...restFormProps },
	...restProps
}: WidgetProps<AutoCompleteProps<string, { label: string; value: string }>>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);

	const [schemaList, setSchemaList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined) {
			api.getAllSchemas({
				sourceId,
			}).then((res) => {
				if (res.code === 1) {
					setSchemaList(res.data || []);
				}
			});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId]);

	return (
		<Form.Item
			name={name}
			label={label}
			rules={[
				{
					required: true,
					message: '请输入index',
				},
				{
					max: 128,
					message: '仅支持1-128个任意字符',
				},
				{
					validator: (_: any, value: string) => {
						if (/\s/.test(value)) {
							return Promise.reject(new Error('不支持空格！'));
						}
						return Promise.resolve();
					},
				},
			]}
			{...restFormProps}
		>
			<AutoComplete<string, { label: string; value: string }>
				getPopupContainer={(container) => container.parentNode}
				placeholder="请输入index"
				style={{ width: '100%' }}
				options={schemaList.map((schema) => ({
					label: schema,
					value: schema,
				}))}
				filterOption={(inputValue, option) =>
					!!option?.value?.toUpperCase().includes(inputValue.toUpperCase())
				}
				{...restProps}
			/>
		</Form.Item>
	);
}

/**
 * IndexType 字段的自动补全组件
 * @dependencies sourceId | index
 */
export function IndexTypeAutoComplete({
	formProps: { label = 'type', name = 'indexType', ...restFormProps },
	...restProps
}: WidgetProps<AutoCompleteProps<string, { label: string; value: string }>>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(replaceLastItem(name, 'sourceId'), form);
	const index = Form.useWatch(replaceLastItem(name, 'index'), form);

	const [tableList, setTableList] = useState<string[]>([]);

	useEffect(() => {
		if (sourceId !== undefined && index !== undefined) {
			setTableList([]);
			api.getOfflineTableList({
				sourceId,
				isSys: false,
				schema: index,
				// name,
				isRead: false,
			}).then((res) => {
				if (res.code === 1) {
					setTableList(res.data || []);
				}
			});

			return () => {
				form.setFieldsValue(convertNamePathToNestedObj(name, undefined));
			};
		}
	}, [sourceId, index]);

	return (
		<Form.Item
			name={name}
			label={label}
			rules={[
				{
					required: true,
					message: '请输入indexType',
				},
				{
					max: 128,
					message: '仅支持1-128个任意字符',
				},
				{
					validator: (_: any, value: string) => {
						if (/\s/.test(value)) {
							return Promise.reject(new Error('不支持空格！'));
						}
						return Promise.resolve();
					},
				},
			]}
			{...restFormProps}
		>
			<AutoComplete<string, { label: string; value: string }>
				getPopupContainer={(container) => container.parentNode}
				style={{ width: '100%' }}
				options={tableList.map((table) => ({
					label: table,
					value: table,
				}))}
				placeholder="请输入indexType"
				filterOption={(inputValue, option) =>
					!!option?.value?.toUpperCase().includes(inputValue.toUpperCase())
				}
				{...restProps}
			/>
		</Form.Item>
	);
}

/**
 * 传输速率自动补全
 */
export function SpeedAutoComplete({
	formProps: { label = '作业速率上限', name = 'speed', ...restFormProps },
	...restProps
}: WidgetProps<AutoCompleteProps<any, any>>) {
	const UnlimitedSpeed = '不限制传输速率';
	/**
	 * 传输速率选择项
	 */
	const SPEED_OPTIONS = new Array(20)
		.fill(1)
		.map((_, index) => ({ value: (index + 1).toString() }));
	/**
	 * 不限制传输速率选择项
	 */
	const UNLIMITED_SPEED_OPTION = [
		{
			value: UnlimitedSpeed,
		},
	];

	return (
		<Form.Item label={label} name={name} required {...restFormProps}>
			<AutoComplete options={UNLIMITED_SPEED_OPTION.concat(SPEED_OPTIONS)} {...restProps}>
				<Input suffix="MB/s" />
			</AutoComplete>
		</Form.Item>
	);
}

/**
 * 作业并发数
 */
export function ChannelAutoComplete({
	formProps: { label = '作业并发数', name = 'channel', ...restFormProps },
	...restProps
}: WidgetProps<AutoCompleteProps<any, any>>) {
	const form = Form.useFormInstance();
	const sourceType = Form.useWatch(['sourceMap', 'type'], form);
	const targetType = Form.useWatch(['targetMap', 'type'], form);

	const CHANNEL_OPTIONS = useMemo(
		() =>
			new Array(5)
				.fill(1)
				.map((_, index) => ({ label: index + 1, value: (index + 1).toString() })),
		[],
	);

	const isClickHouse =
		targetType === DATA_SOURCE_ENUM.CLICKHOUSE ||
		targetType === DATA_SOURCE_ENUM.S3 ||
		sourceType === DATA_SOURCE_ENUM.PHOENIX;

	return (
		<Form.Item label={label} name={name} required {...restFormProps}>
			<AutoComplete
				disabled={isClickHouse}
				options={CHANNEL_OPTIONS}
				optionFilterProp="value"
				{...restProps}
			/>
		</Form.Item>
	);
}

/**
 * 标识字段下拉菜单
 */
export function RestoreColumnSelect({
	formProps: { label = '标识字段', name = 'restoreColumnName', ...restFormProps },
	...restProps
}: WidgetProps<SelectProps>) {
	const form = Form.useFormInstance();
	const sourceId = Form.useWatch(['sourceMap', 'sourceId'], form);
	const table = Form.useWatch(['sourceMap', 'table'], form);
	const schema = Form.useWatch(['sourceMap', 'schema'], form);
	// 增量字段
	const increColumn = Form.useWatch(['sourceMap', 'increColumn'], form);

	const syncModel = Form.useWatch(['sourceMap', 'syncModel'], form);
	const isIncrementMode = useMemo(() => syncModel === DATA_SYNC_MODE.INCREMENT, [syncModel]);

	const [idFields, setIdFields] = useState<{ key: string; type: string }[]>([]); // 标识字段

	useEffect(() => {
		if (sourceId && table) {
			api.getIncrementColumns({
				sourceId,
				tableName: table,
				schema,
			}).then((res) => {
				if (res.code === 1) {
					setIdFields(res.data || []);
				}
			});
		}
	}, [sourceId, table, schema]);

	useEffect(() => {
		if (isIncrementMode && increColumn) {
			form.setFieldsValue(convertNamePathToNestedObj(name, increColumn));
		}
	}, [isIncrementMode, increColumn]);

	return (
		<Form.Item
			name={name}
			label={label}
			rules={[
				{
					required: true,
					message: '请选择标识字段',
				},
			]}
			{...restFormProps}
		>
			<Select
				showSearch
				placeholder="请选择标识字段"
				disabled={isIncrementMode} // 增量模式时，默认使用增量字段，此处禁用选项
				options={idFields.map((o) => ({
					label: `${o.key}（${o.type}）`,
					value: o.key,
				}))}
				{...restProps}
			/>
		</Form.Item>
	);
}
