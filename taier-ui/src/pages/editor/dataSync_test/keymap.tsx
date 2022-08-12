import api from '@/api';
import Resize from '@/components/resize';
import { DATA_SOURCE_ENUM, HBASE_FIELD_TYPES, HDFS_FIELD_TYPES } from '@/constant';
import type { IDataColumnsProps } from '@/interface';
import { Button, Col, Form, message, Row, Spin, Tooltip } from 'antd';
import type { FormInstance } from 'antd/es/form/Form';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isHdfsType } from '@/utils/is';
import { isNumber, isObject, isUndefined } from 'lodash';
import { EditOutlined, MinusOutlined } from '@ant-design/icons';
import ScrollText from '@/components/scrollText';
import { isValidFormatType, OPERATOR_TYPE } from '../dataSync/keymap';
import { mouse, select } from 'd3-selection';
import ConstModal from './modals/constModal';
import BatchModal from './modals/batchModal';
import KeyModal from './modals/keyModal';
import { Utils } from '@dtinsight/dt-utils/lib';

interface IKeyMapProps {
	source: IDataColumnsProps[];
	target: IDataColumnsProps[];
}

/**
 * 获取step容器的大小，最小为450，其他情况为panel大小的5/6;
 */
function getCanvasW() {
	let w = 450;
	const canvas = document.querySelector('.taier__dataSync__keyMap__container');
	if (canvas) {
		const newW = (canvas.getBoundingClientRect().width / 6) * 5;
		if (newW > w) w = newW;
	}
	return w;
}

/**
 * 获取批量添加的默认值
 */
function getBatIntVal(
	type: DATA_SOURCE_ENUM | undefined,
	typeCol: IDataColumnsProps[] | undefined,
) {
	const isNotHBase = type !== DATA_SOURCE_ENUM.HBASE;
	let initialVal = '';
	if (isNotHBase) {
		typeCol?.forEach((item) => {
			const itemKey = Utils.checkExist(item.key) ? item.key : undefined;
			const field = Utils.checkExist(item.index) ? item.index : itemKey;
			if (field !== undefined) {
				initialVal += `${field}:${item.type},\n`;
			}
		});
	} else {
		typeCol?.forEach((item) => {
			const field = Utils.checkExist(item.key) ? item.key : undefined;
			if (field !== undefined) initialVal += `${item.cf || '-'}:${field}:${item.type},\n`;
		});
	}
	return initialVal;
}

function useFormWatchField(form: FormInstance, suffix: string) {
	const type = Form.useWatch([suffix, 'type'], form);
	const sourceId = Form.useWatch([suffix, 'sourceId'], form);
	const table = Form.useWatch([suffix, 'table'], form);
	const schema = Form.useWatch([suffix, 'schema'], form);
	const index = Form.useWatch([suffix, 'index'], form);
	const indexType = Form.useWatch([suffix, 'indexType'], form);
	const column = Form.useWatch([suffix, 'column'], form);
	const fileType = Form.useWatch([suffix, 'fileType'], form);

	// ES 数据源：
	// - tableName 字段取自 indexType,
	// - schema 字段取自 index
	const ES_DATASOURCE = [DATA_SOURCE_ENUM.ES, DATA_SOURCE_ENUM.ES6, DATA_SOURCE_ENUM.ES7];
	return {
		type,
		sourceId,
		table: ES_DATASOURCE.includes(type) ? indexType : table,
		schema: ES_DATASOURCE.includes(type) ? index : schema,
		column,
		fileType,
	};
}

export default function KeyMap() {
	const form = Form.useFormInstance();
	const sourceMap = useFormWatchField(form, 'sourceMap');
	const targetMap = useFormWatchField(form, 'targetMap');
	const [loading, setLoading] = useState(false);

	// 用户自定义的列
	const [userColumns, setUserColumns] = useState<IKeyMapProps>({ source: [], target: [] });
	// 前两步选择的表获取字段
	const [tableColumns, setTableCols] = useState<IKeyMapProps>({
		source: [],
		target: [],
	});

	const [{ h, W, w, padding }, setCanvasInfo] = useState({
		h: 40, // 字段一行高度
		w: 230, // 字段的宽度
		W: 600, // step容器大小
		padding: 10, // 绘制拖拽点左右边距
	});
	// 列族，只有 HDFS 才有
	const [families, setFamilies] = useState<{ source: string[]; target: string[] }>({
		source: [],
		target: [],
	});
	// step 容器
	const $canvas = useRef<SVGSVGElement>(null);
	// 拖动的线
	const $activeLine = useRef<SVGLineElement>(null);
	const [btnTypes, setBtnTypes] = useState({ rowMap: false, nameMap: false });
	const [keyModal, setKeyModal] = useState<{
		visible: boolean;
		isReader: boolean;
		editField: IDataColumnsProps | undefined;
		source: IDataColumnsProps | undefined;
		operation: Valueof<typeof OPERATOR_TYPE>;
	}>({
		visible: false,
		// 区分源表还是目标表
		isReader: false,
		editField: undefined,
		source: undefined,
		operation: OPERATOR_TYPE.ADD,
	});
	const [batchModal, setBatchModal] = useState<{
		visible: boolean;
		isReader: boolean;
		defaultValue?: string;
	}>({
		visible: false,
		// 区分源表还是目标表
		isReader: false,
		defaultValue: undefined,
	});
	const [visibleConst, setConstVisible] = useState(false);

	// 批量添加目标表字段
	const handleBatchAddTargetFields = (batchText: string) => {
		const str = Utils.trim(batchText);
		const arr = str.split(',');

		const params: any = [];

		switch (targetSrcType) {
			case DATA_SOURCE_ENUM.FTP:
			case DATA_SOURCE_ENUM.HDFS:
			case DATA_SOURCE_ENUM.S3: {
				for (let i = 0; i < arr.length; i += 1) {
					const item = arr[i];
					if (item) {
						const map = item.split(':');
						const key = Utils.trim(map[0]);
						const type = Utils.trim(map[1].toUpperCase());
						if (HDFS_FIELD_TYPES.includes(type)) {
							params.push({
								key,
								type,
							});
						} else {
							message.error(`字段${key}的数据类型错误！`);
							return;
						}
					}
				}
				break;
			}
			case DATA_SOURCE_ENUM.HBASE: {
				for (let i = 0; i < arr.length; i += 1) {
					const item = arr[i];
					if (item) {
						const map = item.split(':');
						const cf = Utils.trim(map[0]);
						const name = Utils.trim(map[1]);
						const type = Utils.trim(map[2]);
						if (!HBASE_FIELD_TYPES.includes(type)) {
							message.error(`字段${name}的数据类型错误！`);
							return;
						}
						params.push({
							cf,
							key: name,
							type,
						});
					}
				}
				break;
			}
			default:
				break;
		}
		onColsChanged?.(params, OPERATOR_TYPE.REPLACE, 'target');
		handleHideBatchModal();
	};

	const initEditKeyRow = (
		isReader: boolean,
		sourceCol: IDataColumnsProps | undefined,
		field: IDataColumnsProps | undefined,
	) => {
		setKeyModal({
			visible: true,
			isReader,
			editField: field,
			source: sourceCol,
			operation: OPERATOR_TYPE.EDIT,
		});
	};

	const initAddKeyRow = (isReader: boolean) => {
		setKeyModal({
			visible: true,
			isReader,
			editField: undefined,
			source: undefined,
			operation: OPERATOR_TYPE.ADD,
		});
	};

	const handleOpenBatchModal = (isReader: boolean = true) => {
		const srcType = isReader ? sourceSrcType : targetSrcType;
		const cols = isReader ? sourceCol : targetCol;
		setBatchModal({
			visible: true,
			isReader,
			defaultValue: getBatIntVal(srcType, cols),
		});
	};

	const handleKeyModalSubmit = (values: IDataColumnsProps) => {
		onColsChanged?.(
			Object.assign(keyModal.editField || {}, values),
			keyModal.operation,
			keyModal.isReader ? 'source' : 'target',
		);
		handleHideKeyModal();
	};

	const handleHideKeyModal = () => {
		setKeyModal({
			visible: false,
			isReader: false,
			operation: OPERATOR_TYPE.ADD,
			editField: undefined,
			source: undefined,
		});
	};

	const handleHideBatchModal = () => {
		setBatchModal({
			visible: false,
			isReader: false,
			defaultValue: '',
		});
	};

	// 批量添加源表字段
	const handleBatchAddSourceFields = (batchText: string) => {
		if (!batchText) {
			handleHideBatchModal();
			return;
		}

		const arr = batchText.split(',');
		const params: IDataColumnsProps[] = [];
		switch (sourceSrcType) {
			case DATA_SOURCE_ENUM.FTP:
			case DATA_SOURCE_ENUM.HDFS:
			case DATA_SOURCE_ENUM.S3: {
				for (let i = 0; i < arr.length; i += 1) {
					const item = arr[i].replace(/\n/, '');
					if (item) {
						const map = item.split(':');
						if (map.length < 1) {
							break;
						}
						const key = parseInt(Utils.trim(map[0]), 10);
						const type = map[1] ? Utils.trim(map[1]).toUpperCase() : null;
						if (!Number.isNaN(key) && isNumber(key)) {
							if (type && HDFS_FIELD_TYPES.includes(type)) {
								if (!params.find((pa) => pa.key === key)) {
									params.push({
										key,
										type,
									});
								}
							} else {
								message.error(`索引 ${key} 的数据类型错误！`);
								return;
							}
						} else {
							message.error(`索引名称 ${key} 应该为整数数字！`);
							return;
						}
					}
				}
				break;
			}
			case DATA_SOURCE_ENUM.HBASE: {
				for (let i = 0; i < arr.length; i += 1) {
					const item = arr[i].replace(/\n/, '');
					if (item) {
						const map = item.split(':');
						if (map.length < 2) {
							break;
						}
						const cf = Utils.trim(map[0]);
						const name = Utils.trim(map[1]);
						const type = Utils.trim(map[2]);
						if (!HBASE_FIELD_TYPES.includes(type)) {
							message.error(`字段${name}的数据类型错误！`);
							return;
						}
						params.push({
							cf,
							key: name,
							type,
						});
					}
				}
				break;
			}
			default:
				break;
		}

		onColsChanged?.(params, OPERATOR_TYPE.REPLACE, 'source');
		handleHideBatchModal();
	};

	const loadColumnFamily = () => {
		if (sourceSrcType === DATA_SOURCE_ENUM.HBASE) {
			api.getHBaseColumnFamily({
				sourceId: sourceMap.sourceId,
				tableName: sourceMap.table,
			}).then((res) => {
				if (res.code === 1) {
					setFamilies((f) => ({ ...f, source: res.data || [] }));
				}
			});
		}

		if (targetSrcType === DATA_SOURCE_ENUM.HBASE) {
			api.getHBaseColumnFamily({
				sourceId: targetMap.sourceId,
				tableName: targetMap?.table,
			}).then((res) => {
				if (res.code === 1) {
					setFamilies((f) => ({ ...f, target: res.data || [] }));
				}
			});
		}
	};

	const onColsChanged = (
		columns: IDataColumnsProps | IDataColumnsProps[],
		operation: Valueof<typeof OPERATOR_TYPE>,
		flag: 'source' | 'target',
	) => {
		const cols = Array.isArray(columns) ? columns : [columns];
		switch (operation) {
			case OPERATOR_TYPE.ADD: {
				cols.forEach((col) => {
					setUserColumns((userCol) => {
						const nextCols = { ...userCol };
						const colField = nextCols[flag];
						if (
							Utils.checkExist(col.index) &&
							colField.some((o) => o.index === col.index)
						) {
							message.error(`添加失败：索引值不能重复`);
							return userCol;
						}
						if (Utils.checkExist(col.key) && colField.some((o) => o.key === col.key)) {
							message.error(`添加失败：字段名不能重复`);
							return userCol;
						}
						colField.push(col);
						return nextCols;
					});
				});
				break;
			}
			case OPERATOR_TYPE.REMOVE: {
				cols.forEach((col) => {
					setUserColumns((userCol) => {
						const nextCols = { ...userCol };
						const colField = nextCols[flag];
						if (!colField || !colField.includes(col)) return userCol;
						const idx = colField.indexOf(col);
						colField.splice(idx, 1);
						return nextCols;
					});
				});
				break;
			}
			case OPERATOR_TYPE.EDIT: {
				cols.forEach((col) => {
					setUserColumns((userCol) => {
						const nextCols = { ...userCol };
						const column = nextCols[flag];
						if (!column.includes(col)) return userCol;
						const idx = column.indexOf(col);
						// 这里只做赋值，不做深拷贝
						// 因为字段映射的数组里的值和 column 字段的值是同一个引用，直接改这个值就可以做到都改了。如果做深拷贝则需要改两次值
						Object.assign(column[idx], col);
						return nextCols;
					});
				});
				break;
			}
			case OPERATOR_TYPE.REPLACE: {
				// replace mode is to replace the whole column field
				setUserColumns((uCols) => {
					const nextCols = { ...uCols };
					nextCols[flag] = cols;
					return nextCols;
				});
				break;
			}
			default:
				break;
		}
	};

	const handleAddLines = (source: IDataColumnsProps, target: IDataColumnsProps) => {
		const originalSource = form.getFieldValue(['sourceMap', 'column']) || [];
		const originalTarget = form.getFieldValue(['targetMap', 'column']) || [];
		if (
			!originalSource.some((l) => isFieldMatch(l, source)) &&
			!originalTarget.some((l) => isFieldMatch(l, target))
		) {
			form.setFieldsValue({
				sourceMap: {
					column: [...originalSource, source],
				},
				targetMap: {
					column: [...originalTarget, target],
				},
			});
		}
	};

	const handleRowMapClick = () => {
		const { rowMap, nameMap } = btnTypes;

		if (!rowMap) {
			const source: IDataColumnsProps[] = [];
			const target: IDataColumnsProps[] = [];
			sourceCol.forEach((o, i) => {
				if (targetCol[i]) {
					source.push(o);
					target.push(targetCol[i]);
				}
			});
			form.setFieldsValue({
				sourceMap: {
					column: source,
				},
				targetMap: {
					column: target,
				},
			});
		} else {
			form.setFieldsValue({
				sourceMap: {
					column: [],
				},
				targetMap: {
					column: [],
				},
			});
		}

		setBtnTypes({
			rowMap: !rowMap,
			nameMap: nameMap ? !nameMap : nameMap,
		});
	};

	// 同名映射
	const handleNameMapClick = () => {
		const { nameMap, rowMap } = btnTypes;

		if (!nameMap) {
			const source: IDataColumnsProps[] = [];
			const target: IDataColumnsProps[] = [];
			sourceCol.forEach((o) => {
				const name = o.key.toString().toUpperCase();
				const idx = targetCol.findIndex((col) => {
					const sourceName = col.key.toString().toUpperCase();
					return sourceName === name;
				});
				if (idx !== -1) {
					source.push(o);
					target.push(targetCol[idx]);
				}
			});
			form.setFieldsValue({
				sourceMap: {
					column: source,
				},
				targetMap: {
					column: target,
				},
			});
		} else {
			form.setFieldsValue({
				sourceMap: {
					column: [],
				},
				targetMap: {
					column: [],
				},
			});
		}

		setBtnTypes({
			nameMap: !nameMap,
			rowMap: rowMap ? !rowMap : rowMap,
		});
	};

	// 拷贝源表列
	const handleCopySourceCols = () => {
		if (isHdfsType(targetSrcType)) {
			const serverParams: any = {};
			sourceCol.forEach((item) => {
				serverParams[item.key || item.index!] = item.type;
			});
			api.convertToHiveColumns({
				columns: serverParams,
			}).then((res: any) => {
				if (res.code === 1) {
					const params: any = [];
					Object.getOwnPropertyNames(res.data).forEach((key: any) => {
						params.push({
							key,
							type: res.data[key],
						});
					});
					onColsChanged?.(params, OPERATOR_TYPE.ADD, 'target');
				}
			});
		} else if (sourceCol && sourceCol.length > 0) {
			const params = sourceCol.map((item) => {
				return {
					key: !isUndefined(item.key) ? item.key : item.index!,
					type: item.type,
				};
			});
			onColsChanged?.(params, OPERATOR_TYPE.ADD, 'target');
		}
	};

	// 拷贝目标表列
	const handleCopyTargetCols = () => {
		if (targetCol && targetCol.length > 0) {
			const params = targetCol.map((item, index) => {
				return {
					key: item.key || index.toString(),
					type: item.type,
				};
			});
			onColsChanged?.(params, OPERATOR_TYPE.ADD, 'target');
		}
	};

	const renderSource = () => {
		const colStyle: CSSProperties = {
			left: padding,
			top: padding,
			width: w,
			height: h,
		};

		const renderTableRow = (sourceType?: DATA_SOURCE_ENUM, col?: IDataColumnsProps) => {
			const removeOption = (
				<div
					className="remove-cell"
					onClick={() => col && onColsChanged?.(col, OPERATOR_TYPE.REMOVE, 'source')}
				>
					<Tooltip title="删除当前列">
						<MinusOutlined />
					</Tooltip>
				</div>
			);

			const editOption = (
				<div className="edit-cell" onClick={() => initEditKeyRow(true, undefined, col)}>
					<Tooltip title="编辑当前列">
						<EditOutlined />
					</Tooltip>
				</div>
			);

			const cellOperation = (remove: any, edit: any) => (
				<div>
					{remove}
					{edit}
				</div>
			);

			// eslint-disable-next-line no-nested-ternary
			const typeValue = col
				? col.value
					? `常量(${col.type})`
					: `${col.type ? col.type.toUpperCase() : ''}${
							col.format ? `(${col.format})` : ''
					  }`
				: '';
			const type = col ? <ScrollText value={typeValue} /> : '类型';

			switch (sourceType) {
				case DATA_SOURCE_ENUM.HDFS:
				case DATA_SOURCE_ENUM.S3: {
					const name: any = col ? (
						<ScrollText
							value={
								// eslint-disable-next-line no-nested-ternary
								col.index !== undefined
									? col.index
									: col.value
									? `'${col.key}'`
									: col.key
							}
						/>
					) : (
						'索引位'
					);
					return (
						<div>
							<div className="cell">{name}</div>
							<div className="cell" title={typeValue}>
								{type}
							</div>
							{sourceMap.fileType !== 'orc' ? (
								<div className="cell">
									{col ? cellOperation(removeOption, editOption) : '操作'}
								</div>
							) : (
								''
							)}
						</div>
					);
				}
				case DATA_SOURCE_ENUM.HBASE: {
					const name: any = col ? (
						<ScrollText value={col.value ? `'${col.key}'` : col.key} />
					) : (
						'列名/行健'
					);
					const cf = col ? col.cf : '列族';

					// 仅允许常量删除操作
					const opt =
						col && col.key === 'rowkey'
							? cellOperation(null, editOption)
							: cellOperation(removeOption, editOption);
					return (
						<div className="four-cells">
							<div className="cell" title={cf}>
								{cf || '-'}
							</div>
							<div className="cell">{name}</div>
							<div className="cell" title={typeValue}>
								{type}
							</div>
							<div className="cell">{col ? opt : '操作'}</div>
						</div>
					);
				}
				case DATA_SOURCE_ENUM.MAXCOMPUTE:
				case DATA_SOURCE_ENUM.HIVE1X:
				case DATA_SOURCE_ENUM.HIVE:
				case DATA_SOURCE_ENUM.HIVE3X: {
					const name: any = col ? (
						<ScrollText value={col.value ? `'${col.key}'` : col.key} />
					) : (
						'字段名称'
					);
					// 仅允许常量删除操作
					const opt =
						col && col.value
							? cellOperation(removeOption, editOption)
							: cellOperation(null, editOption);
					return (
						<div>
							<div className="cell">{name}</div>
							<div className="cell" title={typeValue}>
								{type}
							</div>
							<div className="cell">{col ? opt : '操作'}</div>
						</div>
					);
				}
				case DATA_SOURCE_ENUM.IMPALA: {
					const name: any = col ? (
						<ScrollText value={col.value ? `'${col.key}'` : col.key} />
					) : (
						'字段名称'
					);
					// 仅允许常量删除操作
					const opt =
						col && col.value
							? cellOperation(removeOption, editOption)
							: cellOperation(null, editOption);
					return (
						<div>
							<div className="cell">{name}</div>
							<div className="cell" title={typeValue}>
								{type}
								{col && col.isPart && (
									<img
										src="images/primary-key.svg"
										style={{
											float: 'right',
											marginTop: '-26px',
										}}
									/>
								)}
							</div>
							<div className="cell">{col ? opt : '操作'}</div>
						</div>
					);
				}
				case DATA_SOURCE_ENUM.FTP: {
					const name: any = col ? (
						<ScrollText
							value={
								// eslint-disable-next-line no-nested-ternary
								col.index !== undefined
									? col.index
									: col.value
									? `'${col.key}'`
									: col.key
							}
						/>
					) : (
						'字段序号'
					);
					return (
						<div>
							<div className="cell">{name}</div>
							<div className="cell" title={typeValue}>
								{type}
							</div>
							<div className="cell">
								{col ? cellOperation(removeOption, editOption) : '操作'}
							</div>
						</div>
					);
				}
				default: {
					// 常量都允许删除和编辑
					const canFormat = isValidFormatType(col && col.type) || col?.value;
					const opt = (
						<div>
							{col && col.value ? removeOption : ''}
							{canFormat ? editOption : ''}
						</div>
					);
					const name: any = col ? (
						<ScrollText value={col.value ? `'${col.key}'` : col.key} />
					) : (
						'字段名称'
					);
					return (
						<div>
							<div className="cell">{name}</div>
							<div className="cell" title={typeValue}>
								{type}
							</div>
							<div className="cell">{col ? opt : '操作'}</div>
						</div>
					);
				}
			}
		};

		const renderTableFooter = (sourceType?: DATA_SOURCE_ENUM) => {
			let footerContent = null;
			const btnAddConst = (
				<span className="col-plugin" onClick={() => setConstVisible(true)}>
					+添加常量
				</span>
			);
			switch (sourceType) {
				case DATA_SOURCE_ENUM.HBASE:
					footerContent = (
						<span>
							<span className="col-plugin" onClick={() => initAddKeyRow(true)}>
								+添加字段
							</span>
							&nbsp;
							<span className="col-plugin" onClick={() => handleOpenBatchModal()}>
								+文本模式
							</span>
						</span>
					);
					break;
				case DATA_SOURCE_ENUM.HDFS:
				case DATA_SOURCE_ENUM.S3: {
					footerContent =
						sourceMap.fileType !== 'orc' ? (
							<span>
								<span className="col-plugin" onClick={() => initAddKeyRow(true)}>
									+添加字段
								</span>
								&nbsp;
								<span className="col-plugin" onClick={() => handleOpenBatchModal()}>
									+文本模式
								</span>
							</span>
						) : null;
					break;
				}
				case DATA_SOURCE_ENUM.FTP: {
					footerContent = (
						<span>
							<span className="col-plugin" onClick={() => initAddKeyRow(true)}>
								+添加字段
							</span>
							&nbsp;
							<span className="col-plugin" onClick={() => handleOpenBatchModal()}>
								+文本模式
							</span>
						</span>
					);
					break;
				}
				default: {
					footerContent = null;
					break;
				}
			}
			return (
				<div
					className="m-col absolute"
					style={{
						left: padding,
						top: padding + h * (sourceCol.length + 1),
						width: w,
						height: h,
						zIndex: 2,
					}}
				>
					{footerContent}
					{btnAddConst}
				</div>
			);
		};

		return (
			<div className="sourceLeft">
				<div className="m-col title absolute" style={colStyle}>
					{renderTableRow(sourceSrcType)}
				</div>
				{sourceCol.map((col, i) => (
					<div
						style={{
							width: w,
							height: h,
							left: padding,
							top: padding + h * (i + 1),
						}}
						className="m-col absolute"
						key={`sourceLeft-${i}`}
					>
						{renderTableRow(sourceSrcType, col)}
					</div>
				))}
				{renderTableFooter(sourceSrcType)}
			</div>
		);
	};

	const renderTarget = () => {
		const colStyle: CSSProperties = {
			left: W - (padding + w),
			top: padding,
			width: w,
			height: h,
		};

		const renderTableRow = (
			targetType?: DATA_SOURCE_ENUM,
			col?: IDataColumnsProps,
			i?: number,
		) => {
			const operations = (
				<div>
					<div
						className="remove-cell"
						onClick={() => col && onColsChanged?.(col, OPERATOR_TYPE.REMOVE, 'target')}
					>
						<Tooltip title="删除当前列">
							<MinusOutlined />
						</Tooltip>
					</div>
					<div
						className="edit-cell"
						onClick={() => i !== undefined && initEditKeyRow(false, sourceCol[i], col)}
					>
						<Tooltip title="编辑当前列">
							<EditOutlined />
						</Tooltip>
					</div>
				</div>
			);
			switch (targetType) {
				case DATA_SOURCE_ENUM.HDFS:
				case DATA_SOURCE_ENUM.S3: {
					const name = col ? <ScrollText value={col.key} /> : '字段名称';
					const type = col ? col.type.toUpperCase() : '类型';
					return (
						<div>
							<div className="cell">{name}</div>
							<div className="cell" title={type}>
								{type}
							</div>
							<div className="cell">{col ? operations : '操作'}</div>
						</div>
					);
				}
				case DATA_SOURCE_ENUM.HBASE: {
					const name = col ? col.cf : '列族';
					const column: any = col ? <ScrollText value={col.key} /> : '列名';
					const type: any = col ? <ScrollText value={col.type.toUpperCase()} /> : '类型';
					return (
						<div className="four-cells">
							<div className="cell">{name}</div>
							<div className="cell" title={column}>
								{column}
							</div>
							<div className="cell" title={type}>
								{type}
							</div>
							<div className="cell">{col ? operations : '操作'}</div>
						</div>
					);
				}
				case DATA_SOURCE_ENUM.FTP: {
					const column = col ? <ScrollText value={col.key} /> : '字段名称';
					const type = col ? col.type.toUpperCase() : '类型';
					return (
						<div>
							<div
								className="cell"
								title={col ? col.key.toString() : (column as string)}
							>
								{column}
							</div>
							<div className="cell" title={type}>
								{type}
							</div>
							<div className="cell">{col ? operations : '操作'}</div>
						</div>
					);
				}
				case DATA_SOURCE_ENUM.IMPALA: {
					const typeText = col
						? `${col.type.toUpperCase()}${col.isPart ? '(分区字段)' : ''}`
						: '类型';
					const fieldName = col ? <ScrollText value={col.key} /> : '字段名称';
					return (
						<div>
							<div
								className="cell"
								title={col ? col.key.toString() : (fieldName as string)}
							>
								{fieldName}
							</div>
							<div className="cell" title={typeText}>
								{typeText}
								{col && col.isPart && (
									<img
										src="images/primary-key.svg"
										style={{
											float: 'right',
											marginTop: '-26px',
										}}
									/>
								)}
							</div>
						</div>
					);
				}
				default: {
					const typeText = col
						? `${col.type.toUpperCase()}${col.isPart ? '(分区字段)' : ''}`
						: '类型';
					const fieldName: any = col ? <ScrollText value={col.key} /> : '字段名称';
					return (
						<div>
							<div className="cell" title={fieldName}>
								{fieldName}
							</div>
							<div className="cell" title={typeText}>
								{typeText}
							</div>
						</div>
					);
				}
			}
		};

		const renderTableFooter = (targetType?: DATA_SOURCE_ENUM) => {
			let footerContent = null;
			switch (targetType) {
				case DATA_SOURCE_ENUM.HBASE:
					footerContent = (
						<div>
							<span className="col-plugin" onClick={() => initAddKeyRow(false)}>
								+添加字段
							</span>
							&nbsp;
							<span
								className="col-plugin"
								onClick={() => handleOpenBatchModal(false)}
							>
								+文本模式
							</span>
						</div>
					);
					break;
				case DATA_SOURCE_ENUM.HDFS: {
					footerContent = (
						<div>
							<span className="col-plugin" onClick={() => initAddKeyRow(false)}>
								+添加字段
							</span>
							&nbsp;
							<span
								className="col-plugin"
								onClick={() => handleOpenBatchModal(false)}
							>
								+文本模式
							</span>
						</div>
					);
					break;
				}
				case DATA_SOURCE_ENUM.FTP: {
					footerContent = (
						<div>
							<span className="col-plugin" onClick={() => initAddKeyRow(false)}>
								+添加字段
							</span>
							&nbsp;
							<span
								className="col-plugin"
								onClick={() => handleOpenBatchModal(false)}
							>
								+文本模式
							</span>
						</div>
					);
					break;
				}
				case DATA_SOURCE_ENUM.S3: {
					footerContent = (
						<div>
							<span className="col-plugin" onClick={() => initAddKeyRow(false)}>
								+添加字段
							</span>
							&nbsp;
							<span
								className="col-plugin"
								onClick={() => handleOpenBatchModal(false)}
							>
								+文本模式
							</span>
						</div>
					);
					break;
				}
				default: {
					footerContent = null;
					break;
				}
			}
			return footerContent ? (
				<div
					className="m-col footer absolute"
					style={{
						top: padding + h * (targetCol.length + 1),
						left: W - (padding + w),
						width: w,
						height: h,
						zIndex: 2,
					}}
				>
					{footerContent}
				</div>
			) : (
				''
			);
		};

		return (
			<div className="targetRight">
				<div className="m-col title  absolute" style={colStyle}>
					{renderTableRow(targetSrcType)}
				</div>
				{targetCol.map((col, i) => {
					return (
						<div
							key={`targetRight-${i}`}
							className="m-col absolute"
							style={{
								width: w,
								height: h,
								top: padding + h * (i + 1),
								left: W - (padding + w),
							}}
						>
							{renderTableRow(targetSrcType, col, i)}
						</div>
					);
				})}
				{renderTableFooter(targetSrcType)}
			</div>
		);
	};

	useEffect(() => {
		// 设置step容器大小
		setCanvasInfo((f) => ({ ...f, W: getCanvasW() }));
		loadColumnFamily();
	}, []);

	// Get source table columns
	useEffect(() => {
		// Hive，Impala 作为结果表时，需要获取分区字段
		const sourceType = sourceMap.type!;
		const sourcePart =
			+sourceType === DATA_SOURCE_ENUM.HIVE1X ||
			+sourceType === DATA_SOURCE_ENUM.HIVE ||
			+sourceType === DATA_SOURCE_ENUM.HIVE3X ||
			+sourceType === DATA_SOURCE_ENUM.SPARKTHRIFT;

		if (!sourceMap.table && !sourceMap.schema) return;
		setLoading(true);
		api.getOfflineTableColumn({
			sourceId: sourceMap.sourceId,
			schema: sourceMap.schema,
			tableName: Array.isArray(sourceMap.table) ? sourceMap.table[0] : sourceMap.table,
			isIncludePart: sourcePart,
		})
			.then((res) => {
				if (res.code === 1) {
					const sourceMapCol = sourceMap.column || [];
					// TODO: 暂时无法解决没有连线的自定义列或常量保存的问题
					// 取当前选中数据源的表字段和已连线的字段的并集作为 keymap 的数据
					// 因为可能存在常量或自定义列不存在在「数据源的表字段」中，需要从已连线的字段中获取
					const nextSource: IDataColumnsProps[] = res.data;
					sourceMapCol.forEach((col) => {
						if (!nextSource.find((s) => s.key === col.key)) {
							nextSource.push(col);
						}
					});
					setTableCols((cols) => ({ ...cols, source: nextSource }));
				}
			})
			.finally(() => {
				setLoading(false);
			});
	}, [sourceMap.type, sourceMap.table, sourceMap.schema]);

	// Get target table columns
	useEffect(() => {
		// Hive，Impala 作为结果表时，需要获取分区字段
		const type = targetMap.type!;
		const targetPart =
			+type === DATA_SOURCE_ENUM.HIVE1X ||
			+type === DATA_SOURCE_ENUM.HIVE ||
			+type === DATA_SOURCE_ENUM.HIVE3X ||
			+type === DATA_SOURCE_ENUM.SPARKTHRIFT;

		if (!targetMap.table && !targetMap.schema) return;
		setLoading(true);
		api.getOfflineTableColumn({
			sourceId: targetMap.sourceId,
			schema: targetMap.schema,
			tableName: Array.isArray(targetMap.table) ? targetMap.table[0] : targetMap.table,
			isIncludePart: targetPart,
		})
			.then((res) => {
				if (res.code === 1) {
					const targetMapCol = targetMap.column || [];
					// TODO: 暂时无法解决没有连线的自定义列或常量保存的问题
					// 取当前选中数据源的表字段和已连线的字段的并集作为 keymap 的数据
					// 因为可能存在常量或自定义列不存在在「数据源的表字段」中，需要从已连线的字段中获取
					const nextSource: IDataColumnsProps[] = res.data;
					targetMapCol.forEach((col) => {
						if (!nextSource.find((s) => s.key === col.key)) {
							nextSource.push(col);
						}
					});
					setTableCols((cols) => ({ ...cols, target: nextSource }));
				}
			})
			.finally(() => {
				setLoading(false);
			});
	}, [targetMap.type, targetMap.table, targetMap.schema]);

	const dragSvg = () => {
		renderDags(
			$canvas.current,
			(tableColumns?.source || []).concat(userColumns?.source || []),
			(tableColumns?.target || []).concat(userColumns?.target || []),
			{ h, W, w, padding },
		);
		renderLines($canvas.current, lines, { h, W, w, padding });
		bindEvents(
			$canvas.current,
			$activeLine.current,
			{ h, W, w, padding },
			handleAddLines,
			// handleRemoveLines,
		);
	};

	const lines = useMemo(
		() => ({ source: sourceMap.column || [], target: targetMap.column || [] }),
		[sourceMap.column, targetMap.column],
	);

	useEffect(() => {
		// Reset all linesF
		select($canvas.current).selectAll('.dl, .dr, .lines').remove();
		dragSvg();
	}, [lines, tableColumns, userColumns]);

	const sourceSrcType = useMemo(() => sourceMap.type, [sourceMap]);
	const targetSrcType = useMemo(() => targetMap.type, [targetMap]);

	const sourceCol = useMemo(
		() => (tableColumns?.source || []).concat(userColumns?.source || []),
		[tableColumns, userColumns],
	);
	const targetCol = useMemo(
		() => (tableColumns?.target || []).concat(userColumns?.target || []),
		[tableColumns, userColumns],
	);

	const H = useMemo(
		() => h * (Math.max(targetCol.length, sourceCol.length) + 1),
		[sourceCol.length, targetCol.length],
	);

	const renderKeyModal = () => {
		const { operation, isReader, visible } = keyModal;
		const dataType = isReader ? sourceSrcType : targetSrcType;

		let title = '添加HDFS字段';
		if (operation === 'add') {
			if (dataType === DATA_SOURCE_ENUM.HBASE) {
				title = '添加HBase字段';
			} else if (dataType === DATA_SOURCE_ENUM.FTP) {
				title = '添加FTP字段';
			} else if (dataType === DATA_SOURCE_ENUM.S3) {
				title = '添加AWS S3字段';
			}
		} else if (operation === 'edit') {
			title = '修改HDFS字段';
			if (dataType === DATA_SOURCE_ENUM.HBASE) {
				title = '修改HBase字段';
			} else if (dataType === DATA_SOURCE_ENUM.FTP) {
				title = '添加FTP字段';
			} else if (dataType === DATA_SOURCE_ENUM.S3) {
				title = '添加AWS S3字段';
			} else {
				title = '修改字段';
			}
		}

		return (
			<KeyModal
				title={title}
				visible={visible}
				keyModal={keyModal}
				dataType={dataType}
				sourceColumnFamily={families.source}
				targetColumnFamily={families.target}
				onOk={handleKeyModalSubmit}
				onCancel={handleHideKeyModal}
			/>
		);
	};

	const renderBatchModal = () => {
		let sPlaceholder;
		let sDesc;
		let tPlaceholder;
		let tDesc;
		switch (sourceSrcType) {
			case DATA_SOURCE_ENUM.FTP:
			case DATA_SOURCE_ENUM.HDFS:
			case DATA_SOURCE_ENUM.S3: {
				sPlaceholder = '0: STRING,\n1: INTEGER,...';
				sDesc = 'index: type, index: type';
				break;
			}
			case DATA_SOURCE_ENUM.HBASE: {
				sPlaceholder = 'cf1: field1: STRING,\ncf1: field2: INTEGER,...';
				sDesc = 'columnFamily: fieldName: type,';
				break;
			}
			default: {
				break;
			}
		}

		switch (targetSrcType) {
			case DATA_SOURCE_ENUM.FTP:
			case DATA_SOURCE_ENUM.HDFS:
			case DATA_SOURCE_ENUM.S3: {
				tPlaceholder = 'field1: STRING,\nfield2: INTEGER,...';
				tDesc = 'fieldName: type, fieldName: type';
				break;
			}
			case DATA_SOURCE_ENUM.HBASE: {
				tPlaceholder = 'cf1: field1: STRING,\ncf2: field2: INTEGER,...';
				tDesc = 'columnFamily: fieldName: type,';
				break;
			}
			default: {
				break;
			}
		}

		return (
			<>
				<BatchModal
					title="批量添加源表字段"
					desc={sDesc}
					columnFamily={families.source}
					sourceType={sourceSrcType}
					placeholder={sPlaceholder}
					defaultValue={batchModal.defaultValue}
					visible={batchModal.visible && batchModal.isReader}
					onOk={handleBatchAddSourceFields}
					onCancel={handleHideBatchModal}
				/>
				<BatchModal
					title="批量添加目标字段"
					desc={tDesc}
					columnFamily={families.target}
					placeholder={tPlaceholder}
					sourceType={targetSrcType}
					defaultValue={batchModal.defaultValue}
					visible={batchModal.visible && !batchModal.isReader}
					onOk={handleBatchAddTargetFields}
					onCancel={handleHideBatchModal}
				/>
			</>
		);
	};

	return (
		<Resize onResize={() => setCanvasInfo((f) => ({ ...f, W: getCanvasW() }))}>
			<div className="mx-20px taier__dataSync__keyMap__container">
				<p className="text-xs text-center">
					<Form.Item name={['sourceMap', 'column']} hidden />
					<Form.Item name={['targetMap', 'column']} hidden />
					您要配置来源表与目标表的字段映射关系，通过连线将待同步的字段左右相连，也可以通过同行映射、同名映射批量完成映射
				</p>
				<Spin spinning={loading}>
					<Row gutter={12}>
						<Col span={21} className="text-center">
							<div
								className="m-keymapbox"
								style={{
									width: W,
									minHeight: H + 20,
								}}
							>
								{renderSource()}
								{renderTarget()}
								<svg
									ref={$canvas}
									width={W - 30 > w * 2 ? W - w * 2 + 30 : 0}
									height={H}
									className="m-keymapcanvas"
									style={{ left: w, top: padding }}
								>
									<defs>
										<marker
											id="arrow"
											markerUnits="strokeWidth"
											markerWidth="12"
											markerHeight="12"
											viewBox="0 0 12 12"
											refX="6"
											refY="6"
											orient="auto"
										>
											<path
												d="M2,3 L9,6 L2,9 L2,6 L2,3"
												fill="currentColor"
											/>
										</marker>
									</defs>
									<g>
										<line
											ref={$activeLine}
											x1="-10"
											y1="-10"
											x2="-10"
											y2="-10"
											stroke="currentColor"
											strokeWidth="2"
											markerEnd="url(#arrow)"
										/>
									</g>
								</svg>
							</div>
						</Col>
						<Col span={3}>
							<div className="m-buttons">
								<Button
									type={btnTypes.rowMap ? 'primary' : 'default'}
									onClick={handleRowMapClick}
								>
									{btnTypes.rowMap ? '取消同行映射' : '同行映射'}
								</Button>
								<br />
								<Button
									disabled={isHdfsType(sourceSrcType)}
									type={btnTypes.nameMap ? 'primary' : 'default'}
									onClick={handleNameMapClick}
								>
									{btnTypes.nameMap ? '取消同名映射' : '同名映射'}
								</Button>
								<br />
								{isHdfsType(targetSrcType) ? (
									<>
										<Button onClick={handleCopySourceCols}>拷贝源字段</Button>
										<br />
									</>
								) : (
									''
								)}
								{isHdfsType(sourceSrcType) ? (
									<Button onClick={handleCopyTargetCols}>拷贝目标字段</Button>
								) : (
									''
								)}
							</div>
						</Col>
					</Row>
				</Spin>
				{renderKeyModal()}
				{renderBatchModal()}
				<ConstModal
					visible={visibleConst}
					onOk={(col) => {
						onColsChanged?.(col, OPERATOR_TYPE.ADD, 'source');
						setConstVisible(false);
					}}
					onCancel={() => setConstVisible(false)}
				/>
			</div>
		</Resize>
	);
}

function isFieldMatch(source: any, target: any) {
	/**
	 * TODO 目前从接口返回的keymap字段与sourceMap, targetMap中不一致
	 */
	if (isObject(source as any) && isObject(target as any)) {
		const sourceVal = source.key || source.index;
		const tagetVal = target.key || target.index;
		return sourceVal === tagetVal;
	}
	if (isObject(source as any) && !isObject(target as any)) {
		const sourceVal = source.key || source.index;
		return sourceVal === target;
	}
	if (!isObject(source as any) && isObject(target as any)) {
		const targetVal = target.key || target.index;
		return source === targetVal;
	}
	return source === target;
}

/**
 * 绘制字段旁边的拖拽点
 */
const renderDags = (
	container: SVGSVGElement | null,
	sourceCol: IDataColumnsProps[],
	targetCol: IDataColumnsProps[],
	canvasInfo: { w: number; h: number; W: number; padding: number },
) => {
	const { w, h, W, padding } = canvasInfo;

	select(container)
		.append('g')
		.attr('class', 'dl')
		.selectAll('g')
		.data(sourceCol)
		.enter()
		.append('g')
		.attr('class', 'col-dag-l')
		.append('circle')
		.attr('class', 'dag-circle')
		.attr('cx', () => padding)
		.attr('cy', (_, i) => h * (i + 1.5))
		.attr('r', 5)
		.attr('stroke-width', 2)
		.attr('stroke', '#fff')
		.attr('fill', 'currentColor');

	select(container)
		.append('g')
		.attr('class', 'dr')
		.selectAll('g')
		.data(targetCol)
		.enter()
		.append('g')
		.attr('class', 'col-dag-r')
		.append('circle')
		.attr('class', 'dag-circle')
		/**
		 * W-w*2代表绘制区域的宽度
		 */
		.attr('cx', () => W - w * 2 - padding)
		.attr('cy', (_, i) => h * (i + 1.5))
		.attr('r', 5)
		.attr('stroke-width', 2)
		.attr('stroke', '#fff')
		.attr('fill', 'currentColor');
};

function renderLines(
	container: SVGSVGElement | null,
	keymap: { source: IDataColumnsProps[]; target: IDataColumnsProps[] },
	canvasInfo: { w: number; h: number; W: number; padding: number },
) {
	const { w, h, W, padding } = canvasInfo;
	const { source, target } = keymap;
	const $dagL = select(container).selectAll<SVGGElement, IDataColumnsProps>('.col-dag-l');
	const $dagR = select(container).selectAll<SVGGElement, IDataColumnsProps>('.col-dag-r');

	const posArr: {
		s: { x: number; y: number };
		e: { x: number; y: number };
		dl: IDataColumnsProps;
		dr: IDataColumnsProps;
	}[] = [];

	/**
	 * source中的元素 keyObj 类型：
	 * if(sourceSrcType === 1, 2, 3) string
	 * if( === 6) { index, type }
	 */
	source.forEach((keyObj, ii) => {
		$dagL.each((dl, i) => {
			let sx: number;
			let sy: number;
			let ex: number;
			let ey: number;

			if (isFieldMatch(dl, keyObj)) {
				sx = padding;
				sy = (i + 1.5) * h;

				$dagR.each((dr, j) => {
					/**
					 * target[ii] 类型：
					 * if(targetSrcType === 1, 2, 3) string
					 * if( === 6)  obj{ key, type }
					 */
					if (isFieldMatch(dr, target[ii])) {
						ex = W - w * 2 - padding;
						ey = (j + 1.5) * h;

						posArr.push({
							s: { x: sx, y: sy },
							e: { x: ex, y: ey },
							dl: keyObj,
							dr: target[ii],
						});
					}
				});
			}
		});
	});

	const mapline = select(container)
		.append('g')
		.attr('class', 'lines')
		.selectAll('g')
		.data(posArr)
		.enter()
		.append('g')
		.attr('class', 'mapline');

	mapline
		.append('line')
		.attr('x1', (d) => d.s.x)
		.attr('y1', (d) => d.s.y)
		.attr('x2', (d) => d.e.x)
		.attr('y2', (d) => d.e.y)
		.attr('stroke', 'currentColor')
		.attr('stroke-width', 2)
		.attr('marker-end', 'url(#arrow)');
}

function bindEvents(
	container: SVGSVGElement | null,
	lineContainer: SVGGElement | null,
	canvasInfo: { w: number; h: number; W: number; padding: number },
	onAddKeys?: (source: IDataColumnsProps, target: IDataColumnsProps) => void,
	onDeleteKeys?: (source: IDataColumnsProps, target: IDataColumnsProps) => void,
) {
	const { w, h, W, padding } = canvasInfo;
	const $line = select(lineContainer);
	const $dagL = select(container).selectAll<SVGGElement, IDataColumnsProps>('.col-dag-l');
	let isMouseDown = false;
	let sourceKeyObj: IDataColumnsProps | undefined;
	let targetKeyObj: IDataColumnsProps | undefined;

	$dagL.on('mousedown', (d, i) => {
		const sx = padding;
		const sy = (i + 1.5) * h;
		$line.attr('x1', sx).attr('y1', sy).attr('x2', sx).attr('y2', sy);

		sourceKeyObj = d;
		isMouseDown = true;
	});

	const $canvas = select(container);
	$canvas
		.on('mousemove', () => {
			if (isMouseDown) {
				const xy = mouse($canvas.node()!);
				const [ex, ey] = xy;
				const threholdX = W - w * 2 - padding * 2;

				if (ex < threholdX) {
					$line.attr('x2', xy[0]).attr('y2', xy[1]);
				} else {
					const $y = (Math.floor(ey / h) + 0.5) * h;
					const $x = threholdX + padding;
					$line.attr('x2', $x).attr('y2', $y);
				}
			}
		})
		.on('mouseup', () => {
			if (isMouseDown) {
				const xy = mouse($canvas.node()!);
				const [ex, ey] = xy;
				const threholdX = W - w * 2 - padding * 2;

				if (ex < threholdX) resetActiveLine(lineContainer);
				else {
					const tidx = Math.floor(ey / h) - 1;
					const $dagR = select(container).selectAll('.col-dag-r');

					$dagR.each((d: any, i: any) => {
						if (i === tidx) {
							targetKeyObj = d;
						}
					});
				}
			}
			if (sourceKeyObj && targetKeyObj) {
				/**
				 * 存储连线
				 */
				onAddKeys?.(sourceKeyObj, targetKeyObj);
				resetActiveLine(lineContainer);
			}

			isMouseDown = false;
		});

	$canvas
		.selectAll<
			SVGGElement,
			{
				s: { x: number; y: number };
				e: { x: number; y: number };
				dl: IDataColumnsProps;
				dr: IDataColumnsProps;
			}
		>('.mapline')
		.on('mouseover', (_, i, nodes) => {
			select(nodes[i]).select('line').attr('stroke-width', 3).attr('stroke', '#2491F7');
		})
		.on('mouseout', (_, i, nodes) => {
			select(nodes[i]).select('line').attr('stroke-width', 2).attr('stroke', '#2491F7');
		})
		.on('click', (d) => {
			/**
			 * 删除连线
			 */
			onDeleteKeys?.(d.dl, d.dr);
		});
}

function resetActiveLine(container: SVGGElement | null) {
	select(container).attr('x1', -10).attr('y1', -10).attr('x2', -10).attr('y2', -10);
}
