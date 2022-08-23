import { mouse, select } from 'd3-selection';
import api from '@/api';
import Resize from '@/components/resize';
import { DATA_SOURCE_ENUM, DATA_SOURCE_TEXT } from '@/constant';
import type { IDataColumnsProps } from '@/interface';
import { isHdfsType } from '@/utils/is';
import { EditOutlined, MinusOutlined } from '@ant-design/icons';
import { Button, Col, Form, message, Row, Space, Spin, Table, Tooltip } from 'antd';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { IFormFieldProps } from '.';
import { isValidFormatType } from '../dataSync/keymap';
import ConstModal from './modals/constModal';
import { checkExist } from '@/utils';
import KeyModal from './modals/keyModal';
import classNames from 'classnames';
import './keymap.scss';

enum QuickColumnKind {
	/**
	 * 同行映射
	 */
	ROW_MAP,
	/**
	 * 同名映射
	 */
	NAME_MAP,
	/**
	 * 重置
	 */
	RESET,
}

const dragPointClassName = 'taier__drag__point';
const svgClassName = 'taier__dataSync__keyMap__lines';
const previewerLineClassName = 'taier__datSync__previewer__line';

export default function KeyMap() {
	const form = Form.useFormInstance<IFormFieldProps>();
	const targetMap = Form.useWatch(['targetMap'], form);
	const sourceMap = Form.useWatch(['sourceMap'], form);

	const [disabled, setDisabled] = useState(true);
	const [loading, setLoading] = useState(false);
	// step 容器
	const $canvas = useRef<SVGSVGElement>(null);

	const handleSetColumns = (kind: QuickColumnKind) => {
		const sourceColumns: IDataColumnsProps[] = [];
		select(`.${svgClassName}`)
			.select('.dl')
			.selectAll<SVGCircleElement, IDataColumnsProps>('.dag-circle')
			.each((data) => {
				sourceColumns.push(data);
			});
		const targetColumns: IDataColumnsProps[] = [];
		select(`.${svgClassName}`)
			.select('.dr')
			.selectAll<SVGCircleElement, IDataColumnsProps>('.dag-circle')
			.each((data) => {
				targetColumns.push(data);
			});

		switch (kind) {
			case QuickColumnKind.NAME_MAP: {
				const source: IDataColumnsProps[] = [];
				const target: IDataColumnsProps[] = [];
				sourceColumns.forEach((o) => {
					const name = o.key.toString().toUpperCase();
					const idx = targetColumns.findIndex((col) => {
						const sourceName = col.key.toString().toUpperCase();
						return sourceName === name;
					});
					if (idx !== -1) {
						source.push(o);
						target.push(targetColumns[idx]);
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
				break;
			}
			case QuickColumnKind.ROW_MAP: {
				const source: IDataColumnsProps[] = [];
				const target: IDataColumnsProps[] = [];
				sourceColumns.forEach((o, i) => {
					if (targetColumns[i]) {
						source.push(o);
						target.push(targetColumns[i]);
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
				break;
			}
			case QuickColumnKind.RESET: {
				form.setFieldsValue({
					sourceMap: {
						column: [],
					},
					targetMap: {
						column: [],
					},
				});
				break;
			}
			default:
				break;
		}
	};

	const handleUpdateValue = () => {
		// remove all lines before render
		select(`.${svgClassName}`).selectAll('.lines').remove();

		const sourceDragList = Array.from<SVGGElement>(
			document.querySelector(`.${svgClassName}`)?.querySelectorAll('.col-dag-l') || [],
		);
		const targetDragList = Array.from<SVGGElement>(
			document.querySelector(`.${svgClassName}`)?.querySelectorAll('.col-dag-r') || [],
		);

		const sourceCol: IDataColumnsProps[] = form.getFieldValue(['sourceMap', 'column']) || [];
		const targetCol: IDataColumnsProps[] = form.getFieldValue(['targetMap', 'column']) || [];

		if (sourceDragList.length && targetDragList.length) {
			setDisabled(false);
		}

		if (
			sourceDragList.length &&
			targetDragList.length &&
			sourceCol.length === targetCol.length
		) {
			const positions: {
				x1: string;
				x2: string;
				y1: string;
				y2: string;
				source: IDataColumnsProps;
				target: IDataColumnsProps;
			}[] = [];

			// Get the positions for each source column
			sourceCol.forEach((source, idx) => {
				const target = targetCol[idx];
				const sourcePoint = sourceDragList.find(
					(ele) => ele.dataset.key === getUniqueKey(source),
				);
				const targetPoint = targetDragList.find(
					(ele) => ele.dataset.key === getUniqueKey(target),
				);
				positions.push({
					x1: sourcePoint?.firstElementChild?.getAttribute('cx') || '0',
					x2: targetPoint?.firstElementChild?.getAttribute('cx') || '0',
					y1: sourcePoint?.firstElementChild?.getAttribute('cy') || '0',
					y2: targetPoint?.firstElementChild?.getAttribute('cy') || '0',
					source,
					target,
				});
			});

			// Insert line element
			select(`.${svgClassName}`)
				.append('g')
				.attr('class', 'lines')
				.selectAll('g')
				.data(positions)
				.enter()
				.append('g')
				.attr('class', 'mapline cursor-pointer')
				.append('line')
				.attr('x1', (d) => d.x1)
				.attr('y1', (d) => d.y1)
				.attr('x2', (d) => Number(d.x2) - 10)
				.attr('y2', (d) => d.y2)
				.attr('stroke', 'currentColor')
				.attr('stroke-width', 2)
				.attr('marker-end', 'url(#arrow)');

			// Binding mouse events for line element
			bindEventsForLines();
		}
	};

	const bindEventsForLines = () => {
		select(`.${svgClassName}`)
			.selectAll<SVGGElement, { source: IDataColumnsProps; target: IDataColumnsProps }>(
				'.mapline',
			)
			.on('mouseover', (_, i, nodes) => {
				select(nodes[i]).select('line').attr('stroke-width', 3).attr('stroke', '#2491F7');

				const [, ey] = mouse(nodes[i]);
				const rect = nodes[i].getBoundingClientRect();
				select('.taier__dataSync__tooltips')
					.style('top', `${ey}px`)
					.style('left', `${rect.width / 2}px`)
					.style('opacity', 0.7);
			})
			.on('mouseout', (_, i, nodes) => {
				select(nodes[i]).select('line').attr('stroke-width', 2).attr('stroke', '#2491F7');

				// Delay invisible in 0.1s
				setTimeout(() => {
					select('.taier__dataSync__tooltips').style('opacity', 0);
				}, 100);
			})
			.on('click', (d) => {
				/**
				 * 删除连线
				 */
				const nextColumns = {
					source: form.getFieldValue(['sourceMap', 'column']) as IDataColumnsProps[],
					target: form.getFieldValue(['targetMap', 'column']) as IDataColumnsProps[],
				};

				nextColumns.source = nextColumns.source.filter(
					(col) => getUniqueKey(col) !== getUniqueKey(d.source),
				);
				nextColumns.target = nextColumns.target.filter(
					(col) => getUniqueKey(col) !== getUniqueKey(d.target),
				);

				form.setFieldValue(['sourceMap', 'column'], nextColumns.source);
				form.setFieldValue(['targetMap', 'column'], nextColumns.target);

				select('.taier__dataSync__tooltips').style('opacity', 0);
			});
	};

	useEffect(() => {
		select($canvas.current)
			.on('mousemove', () => {
				if (select($canvas.current).select(`.${previewerLineClassName}`).size()) {
					const [ex, ey] = mouse(select($canvas.current).node()!);

					select($canvas.current)
						.select(`.${previewerLineClassName}`)
						.attr('x2', ex)
						.attr('y2', ey);
				}
			})
			.on('mouseup', () => {
				const previewerLine = select<SVGElement, IDataColumnsProps>(
					`.${svgClassName}`,
				).select<SVGLineElement>(`.${previewerLineClassName}`);
				if (previewerLine.size()) {
					previewerLine.remove();
				}
			});
	}, []);

	useLayoutEffect(() => {
		// Update line based on columns at each time
		handleUpdateValue();
	}, [sourceMap?.column, targetMap?.column]);

	const targetSrcType = useMemo(() => targetMap?.type, [targetMap]);
	const sourceSrcType = useMemo(() => sourceMap?.type, [sourceMap]);

	return (
		<Resize onResize={() => handleUpdateValue()}>
			<p className="text-center">
				您要配置来源表与目标表的字段映射关系，通过连线将待同步的字段左右相连，也可以通过同行映射、同名映射批量完成映射
			</p>
			<Spin spinning={loading}>
				<Row gutter={12}>
					<Col span={21}>
						<div className="taier__dataSync__keyMap__container">
							<Form.Item
								noStyle
								dependencies={[
									['sourceMap', 'sourceId'],
									['sourceMap', 'table'],
									['sourceMap', 'schema'],
									['sourceMap', 'fileType'],
								]}
							>
								{({ getFieldValue }) => (
									<Form.Item name={['sourceMap', 'column']} noStyle>
										<SourceTable
											disabled={disabled}
											type={sourceSrcType}
											sourceId={getFieldValue(['sourceMap', 'sourceId'])}
											table={getFieldValue(['sourceMap', 'table'])}
											schema={getFieldValue(['sourceMap', 'schema'])}
											fileType={getFieldValue(['sourceMap', 'fileType'])}
											onUpdateDragPoint={handleUpdateValue}
											setLoading={setLoading}
										/>
									</Form.Item>
								)}
							</Form.Item>
							<svg ref={$canvas} className={svgClassName}>
								<marker
									id="arrow"
									markerUnits="userSpaceOnUse"
									markerWidth="20"
									markerHeight="20"
									viewBox="0 0 12 12"
									refX="6"
									refY="6"
									orient="auto"
								>
									<path d="M2,3 L9,6 L2,9 L2,6 L2,3" fill="currentColor" />
								</marker>
								<foreignObject x="0" y="0" width="100%" height="100%">
									<div className="taier__dataSync__tooltips" role="tooltips">
										取消映射
									</div>
								</foreignObject>
							</svg>
							<Form.Item
								noStyle
								dependencies={[
									['targetMap', 'sourceId'],
									['targetMap', 'table'],
									['targetMap', 'schema'],
									// Still depends on sourceMap.fileType
									['sourceMap', 'fileType'],
								]}
							>
								{({ getFieldValue }) => (
									<Form.Item name={['targetMap', 'column']} noStyle>
										<TargetTable
											disabled={disabled}
											type={targetSrcType}
											sourceId={getFieldValue(['targetMap', 'sourceId'])}
											table={getFieldValue(['targetMap', 'table'])}
											schema={getFieldValue(['targetMap', 'schema'])}
											fileType={getFieldValue(['sourceMap', 'fileType'])}
											onUpdateDragPoint={handleUpdateValue}
											setLoading={setLoading}
										/>
									</Form.Item>
								)}
							</Form.Item>
						</div>
					</Col>
					<Col span={3}>
						<Space
							direction="vertical"
							size={5}
							className="taier__dataSync__keyMap__buttonGroups"
						>
							<Button
								type="default"
								disabled={disabled}
								onClick={() => handleSetColumns(QuickColumnKind.ROW_MAP)}
								block
							>
								同行映射
							</Button>
							<Button
								disabled={isHdfsType(sourceSrcType) || disabled}
								type="default"
								onClick={() => handleSetColumns(QuickColumnKind.NAME_MAP)}
								block
							>
								同名映射
							</Button>
							{/* {isHdfsType(targetSrcType) && (
							<Button disabled={disabled} onClick={handleCopySourceCols}>
								拷贝源字段
							</Button>
						)}
						{isHdfsType(sourceSrcType) && (
							<Button disabled={disabled} onClick={handleCopyTargetCols}>
								拷贝目标字段
							</Button>
						)} */}
							<Button
								disabled={disabled}
								type="default"
								onClick={() => handleSetColumns(QuickColumnKind.RESET)}
								block
							>
								重置
							</Button>
						</Space>
					</Col>
				</Row>
			</Spin>
		</Resize>
	);
}

interface IKeyMapTableProps {
	value?: IDataColumnsProps[];
	disabled?: boolean;
	/**
	 * 数据源类型
	 */
	type?: DATA_SOURCE_ENUM;
	/**
	 * 数据源 id
	 */
	sourceId?: number;
	/**
	 * 数据源下的表名
	 */
	table?: string[] | string;
	/**
	 * 部分数据源存在 schema
	 */
	schema?: string;
	fileType?: string;
	onChange?: (data: IDataColumnsProps[]) => void;
	onUpdateDragPoint?: () => void;
	setLoading?: React.Dispatch<React.SetStateAction<boolean>>;
}

enum OperatorKind {
	ADD,
	REMOVE,
	EDIT,
	// replace is different from edit, which is change the whole columns
	REPLACE,
}

function getUniqueKey(data: IDataColumnsProps) {
	return `${data.key}-${data.type}`;
}

/**
 * 字段映射左侧源表表格
 */
function SourceTable({
	value,
	onChange,
	disabled,
	type,
	table,
	sourceId,
	schema,
	fileType,
	onUpdateDragPoint,
	setLoading,
}: IKeyMapTableProps) {
	const form = Form.useFormInstance<IFormFieldProps>();
	const [sourceCol, setSourceCol] = useState<IDataColumnsProps[]>([]);
	const [visibleConst, setConstVisible] = useState(false);
	const [keyModal, setKeyModal] = useState<{
		visible: boolean;
		isReader: boolean;
		editField: IDataColumnsProps | undefined;
		source: IDataColumnsProps | undefined;
		operation: OperatorKind;
	}>({
		visible: false,
		// 区分源表还是目标表
		isReader: true,
		editField: undefined,
		source: undefined,
		operation: OperatorKind.ADD,
	});

	const handleColChanged = (action: OperatorKind, columns: IDataColumnsProps[]) => {
		switch (action) {
			case OperatorKind.ADD: {
				setSourceCol((cols) => {
					const nextCols = [...cols];
					columns.forEach((col) => {
						if (checkExist(col.index) && nextCols.some((o) => o.index === col.index)) {
							message.error(`添加失败：索引值不能重复`);
						} else if (checkExist(col.key) && nextCols.some((o) => o.key === col.key)) {
							message.error(`添加失败：字段名不能重复`);
						} else {
							nextCols.push(col);
						}
					});
					return nextCols;
				});
				break;
			}

			case OperatorKind.REMOVE: {
				const sourceColumn: IDataColumnsProps[] = value || [];
				const targetColumn: IDataColumnsProps[] =
					form.getFieldValue(['targetMap', 'column']) || [];
				const pendingIdx = columns.reduce<number[]>((pre, cur) => {
					const idx = sourceColumn.findIndex(
						(col) => getUniqueKey(col) === getUniqueKey(cur),
					);
					if (idx >= 0) {
						pre.push(idx);
					}
					return pre;
				}, []);
				if (pendingIdx.length) {
					let nextValue = value ?? [];
					nextValue = nextValue.filter((_, idx) => !pendingIdx.includes(idx));
					const nextTarget = targetColumn.filter((_, idx) => !pendingIdx.includes(idx));

					onChange?.(nextValue);
					form.setFieldValue(['targetMap', 'column'], nextTarget);
				}

				setSourceCol((cols) => {
					const nextCols = [...cols];
					columns.forEach((col) => {
						const idx = nextCols.findIndex(
							(c) => getUniqueKey(c) === getUniqueKey(col),
						);
						if (idx !== -1) {
							nextCols.splice(idx, 1);
						}
					});
					return nextCols;
				});
				break;
			}

			case OperatorKind.EDIT: {
				const nextValue = value ?? [];
				columns.forEach((col) => {
					const obj = nextValue.find((val) => getUniqueKey(val) === getUniqueKey(col));
					if (obj) {
						Object.assign(obj, { ...col });
					}
				});
				onChange?.([...nextValue]);

				setSourceCol((cols) => {
					const nextCols = [...cols];
					columns.forEach((col) => {
						const idx = nextCols.findIndex(
							(c) => getUniqueKey(c) === getUniqueKey(col),
						);
						if (idx !== -1) {
							// 这里只做赋值，不做深拷贝
							// 因为字段映射的数组里的值和 column 字段的值是同一个引用，直接改这个值就可以做到都改了。如果做深拷贝则需要改两次值
							Object.assign(nextCols[idx], col);
						}
					});
					return nextCols;
				});
				break;
			}

			case OperatorKind.REPLACE: {
				// replace mode is to replace the whole column field
				setSourceCol(columns);
				break;
			}

			default:
				break;
		}
	};

	const handleOpenKeyModal = (
		source: IDataColumnsProps | undefined,
		field: IDataColumnsProps | undefined,
	) => {
		setKeyModal({
			visible: true,
			isReader: true,
			editField: field,
			source,
			operation: OperatorKind.EDIT,
		});
	};

	const bindEventForPoint = () => {
		select(`.dl`)
			.selectAll<SVGCircleElement, IDataColumnsProps>('.dag-circle')
			.on('mousedown', (data, idx, node) => {
				const sourceColumns: IDataColumnsProps[] =
					form.getFieldValue(['sourceMap', 'column']) ?? [];

				// Ensure each source point ONLY has one out edge
				if (!sourceColumns.find((col) => getUniqueKey(col) === getUniqueKey(data))) {
					const cx = node[idx].getAttribute('cx')!;
					const cy = node[idx].getAttribute('cy')!;

					// Insert a previewer line
					select(`.${svgClassName}`)
						.append('g')
						.data([data])
						.append('line')
						.attr('class', previewerLineClassName)
						.attr('x1', cx)
						.attr('y1', cy)
						.attr('x2', cx)
						.attr('y2', cy)
						.attr('stroke', 'currentColor')
						.attr('stroke-width', '2')
						.attr('marker-end', 'url(#arrow)');
				}
			});
	};

	const renderDragPoint = () => {
		// remove all points before render
		select(`.${svgClassName}`).selectAll('.dl').remove();

		const tableRows = document
			.querySelector('.taier__dataSync__sourceTable')
			?.querySelector(`.${dragPointClassName}`);

		const perHeight = tableRows?.getBoundingClientRect().height || 0;

		// Insert points
		select(`.${svgClassName}`)
			.append('g')
			.attr('class', 'dl')
			.selectAll('g')
			.data(sourceCol)
			.enter()
			.append('g')
			.attr('class', 'col-dag-l cursor-crosshair')
			.attr('data-key', (data) => getUniqueKey(data))
			.append('circle')
			.attr('class', 'dag-circle')
			.attr('cx', () => 10)
			.attr('cy', (_, i) => perHeight * (i + 1.5))
			.attr('r', 5)
			.attr('stroke-width', 2)
			.attr('stroke', '#fff')
			.attr('fill', 'currentColor');

		bindEventForPoint();
		onUpdateDragPoint?.();
	};

	// Get source table columns
	useEffect(() => {
		// Hive，Impala 作为结果表时，需要获取分区字段
		const sourceType = type;
		const sourcePart = [
			DATA_SOURCE_ENUM.HIVE1X,
			DATA_SOURCE_ENUM.HIVE,
			DATA_SOURCE_ENUM.HIVE3X,
			DATA_SOURCE_ENUM.SPARKTHRIFT,
		].includes(Number(sourceType));

		const tableName = Array.isArray(table) ? table[0] : table;

		if (tableName !== undefined && sourceId !== undefined && type !== undefined) {
			setLoading?.(true);
			api.getOfflineTableColumn({
				sourceId,
				schema,
				tableName,
				isIncludePart: sourcePart,
			})
				.then((res) => {
					if (res.code === 1) {
						const sourceMapCol: IDataColumnsProps[] = value || [];
						// TODO: 暂时无法解决没有连线的自定义列或常量保存的问题
						// 取当前选中数据源的表字段和已连线的字段的并集作为 keymap 的数据
						// 因为可能存在常量或自定义列不存在在「数据源的表字段」中，需要从已连线的字段中获取
						const nextSource: IDataColumnsProps[] = res.data;
						sourceMapCol.forEach((col) => {
							if (!nextSource.find((s) => s.key === col.key)) {
								nextSource.push(col);
							}
						});
						setSourceCol(nextSource);
					}
				})
				.finally(() => {
					setLoading?.(false);
				});
		} else {
			setSourceCol([]);
		}

		return () => {
			if (sourceCol.length) {
				// Reset fields
				onChange?.([]);
			}
		};
	}, [type, table, schema]);

	// render drag points
	useLayoutEffect(() => {
		if (sourceCol.length) {
			renderDragPoint();
		}
	}, [sourceCol.length]);

	const keyModalTitle = useMemo(() => {
		if (keyModal.visible && type) {
			return `${keyModal.operation === OperatorKind.ADD ? '添加' : '编辑'}${
				DATA_SOURCE_TEXT[type]
			}字段`;
		}
		return '';
	}, [keyModal]);

	return (
		<Resize onResize={() => renderDragPoint()}>
			<Table
				className="taier__dataSync__sourceTable"
				dataSource={sourceCol}
				size="small"
				rowKey={(data) => getUniqueKey(data)}
				rowClassName={dragPointClassName}
				pagination={false}
				footer={() => {
					const footerButtonGroups = (
						<Space direction="vertical">
							<Button
								type="text"
								onClick={() =>
									setKeyModal({
										visible: true,
										isReader: true,
										editField: undefined,
										source: undefined,
										operation: OperatorKind.ADD,
									})
								}
								disabled={disabled}
							>
								+添加字段
							</Button>
							<Button
								type="text"
								// onClick={() => handleOpenBatchModal()}
								disabled={disabled}
							>
								+文本模式
							</Button>
						</Space>
					);
					return (
						<>
							{(() => {
								switch (type) {
									case DATA_SOURCE_ENUM.FTP:
									case DATA_SOURCE_ENUM.HBASE:
										return footerButtonGroups;
									case DATA_SOURCE_ENUM.HDFS:
									case DATA_SOURCE_ENUM.S3: {
										return fileType !== 'orc' && footerButtonGroups;
									}
									default:
										return null;
								}
							})()}
							<Button
								type="text"
								onClick={() => setConstVisible(true)}
								disabled={disabled}
							>
								+添加常量
							</Button>
						</>
					);
				}}
			>
				{(() => {
					const removeAction = (record: IDataColumnsProps) => (
						<Tooltip title="删除当前列">
							<MinusOutlined
								className={classNames(disabled && 'taier__dataSync--disabled')}
								onClick={() =>
									!disabled && handleColChanged(OperatorKind.REMOVE, [record])
								}
							/>
						</Tooltip>
					);
					const editAction = (record: IDataColumnsProps) => (
						<Tooltip title="编辑当前列">
							<EditOutlined
								className={classNames(disabled && 'taier__dataSync--disabled')}
								onClick={() => !disabled && handleOpenKeyModal(undefined, record)}
							/>
						</Tooltip>
					);

					switch (type) {
						case DATA_SOURCE_ENUM.HDFS:
						case DATA_SOURCE_ENUM.S3: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="索引位"
										dataIndex="index"
										key="index"
										render={(val, record) => {
											const formatVal = record.value
												? `'${record.key}'`
												: record.key;
											return val || formatVal;
										}}
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val, record) => {
											return record.value
												? `常量(${record.type})`
												: `${val ? val.toUpperCase() : ''}${
														record.format ? `(${record.format})` : ''
												  }`;
										}}
									/>
									{fileType !== 'orc' && (
										<Table.Column<IDataColumnsProps>
											title="操作"
											key="action"
											render={(_, record) => {
												return (
													<Space>
														{removeAction(record)}
														{editAction(record)}
													</Space>
												);
											}}
										/>
									)}
								</>
							);
						}
						case DATA_SOURCE_ENUM.HBASE: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="列族"
										dataIndex="cf"
										key="cf"
									/>
									<Table.Column<IDataColumnsProps>
										title="列名/行健"
										dataIndex="value"
										key="value"
										render={(val, record) =>
											val ? `'${record.key}'` : record.key
										}
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val, record) => {
											return record.value
												? `常量(${record.type})`
												: `${val ? val.toUpperCase() : ''}${
														record.format ? `(${record.format})` : ''
												  }`;
										}}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record) => {
											// 仅允许常量删除操作
											return (
												<Space>
													{record.key !== 'rowKey' &&
														removeAction(record)}
													{editAction(record)}
												</Space>
											);
										}}
									/>
								</>
							);
						}
						case DATA_SOURCE_ENUM.MAXCOMPUTE:
						case DATA_SOURCE_ENUM.HIVE1X:
						case DATA_SOURCE_ENUM.HIVE:
						case DATA_SOURCE_ENUM.HIVE3X: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段名称"
										dataIndex="value"
										key="value"
										render={(val, record) =>
											val ? `'${record.key}'` : record.key
										}
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val, record) => {
											return record.value
												? `常量(${record.type})`
												: `${val ? val.toUpperCase() : ''}${
														record.format ? `(${record.format})` : ''
												  }`;
										}}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record) => {
											// 仅允许常量删除操作
											return (
												<Space>
													{record.value && removeAction(record)}
													{editAction(record)}
												</Space>
											);
										}}
									/>
								</>
							);
						}
						case DATA_SOURCE_ENUM.IMPALA: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段名称"
										key="value"
										dataIndex="value"
										render={(val, record) =>
											val ? `'${record.key}'` : record.key
										}
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val, record) => {
											return (
												<>
													{record.value
														? `常量(${record.type})`
														: `${val ? val.toUpperCase() : ''}${
																record.format
																	? `(${record.format})`
																	: ''
														  }`}
													{record.isPart && (
														<img src="images/primary-key.svg" />
													)}
												</>
											);
										}}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record) => {
											// 仅允许常量删除操作
											return (
												<Space>
													{record.value && removeAction(record)}
													{editAction(record)}
												</Space>
											);
										}}
									/>
								</>
							);
						}
						case DATA_SOURCE_ENUM.FTP: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段序号"
										key="index"
										dataIndex="index"
										render={(val, record) => {
											const formatVal = record.value
												? `'${record.key}'`
												: record.key;
											return val || formatVal;
										}}
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val, record) => {
											return (
												<>
													{record.value
														? `常量(${record.type})`
														: `${val ? val.toUpperCase() : ''}${
																record.format
																	? `(${record.format})`
																	: ''
														  }`}
													{record.isPart && (
														<img src="images/primary-key.svg" />
													)}
												</>
											);
										}}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record) => {
											return (
												<Space>
													{removeAction(record)}
													{editAction(record)}
												</Space>
											);
										}}
									/>
								</>
							);
						}
						default: {
							// 常量都允许删除和编辑
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段名称"
										dataIndex="value"
										key="value"
										ellipsis
										render={(val, record) => (
											<Tooltip title={val ? `'${record.key}'` : record.key}>
												{val ? `'${record.key}'` : record.key}
											</Tooltip>
										)}
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										ellipsis
										render={(val, record) => {
											const title = record.value
												? `常量(${record.type})`
												: `${val ? val.toUpperCase() : ''}${
														record.format ? `(${record.format})` : ''
												  }`;
											return (
												<>
													<Tooltip title={title}>{title}</Tooltip>
													{record.isPart && (
														<img src="images/primary-key.svg" />
													)}
												</>
											);
										}}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record) => {
											return (
												<Space>
													{record.value && removeAction(record)}
													{(isValidFormatType(record.type) ||
														record.value) &&
														editAction(record)}
												</Space>
											);
										}}
									/>
								</>
							);
						}
					}
				})()}
			</Table>
			<ConstModal
				visible={visibleConst}
				onOk={(col) => {
					handleColChanged(OperatorKind.ADD, [col]);
					setConstVisible(false);
				}}
				onCancel={() => setConstVisible(false)}
			/>
			<KeyModal
				title={keyModalTitle}
				visible={keyModal.visible}
				keyModal={keyModal}
				dataType={type}
				// sourceColumnFamily={families.source}
				// targetColumnFamily={families.target}
				onOk={(values: IDataColumnsProps) => {
					handleColChanged(keyModal.operation, [values]);
					setKeyModal((m) => ({ ...m, visible: false }));
				}}
				onCancel={() => setKeyModal((m) => ({ ...m, visible: false }))}
			/>
		</Resize>
	);
}

/**
 * 字段映射右侧目标表表格
 */
function TargetTable({
	value,
	disabled,
	type,
	sourceId,
	schema,
	table,
	fileType,
	onChange,
	onUpdateDragPoint,
	setLoading,
}: IKeyMapTableProps) {
	const form = Form.useFormInstance<IFormFieldProps>();
	const [targetCol, setTargetCol] = useState<IDataColumnsProps[]>([]);

	const bindEventForPoint = () => {
		select(`.${svgClassName}`)
			.select('.dr')
			.selectAll<SVGCircleElement, IDataColumnsProps>('.dag-circle')
			.on('mouseup', (data) => {
				const previewerLine = select<SVGElement, IDataColumnsProps>(
					`.${svgClassName}`,
				).select<SVGLineElement>(`.${previewerLineClassName}`);

				if (previewerLine.size()) {
					const targetColumn: IDataColumnsProps[] =
						form.getFieldValue(['targetMap', 'column']) ?? [];

					const sourceColumn: IDataColumnsProps[] =
						form.getFieldValue(['sourceMap', 'column']) ?? [];
					const sourceData = previewerLine.data();

					// Ensure each target point ONLY has one IN edge
					if (!targetColumn.find((col) => getUniqueKey(col) === getUniqueKey(data))) {
						targetColumn.push(data);
						const nextSourceColumn = sourceColumn.concat(sourceData);

						onChange?.(targetColumn);
						form.setFieldValue(['sourceMap', 'column'], nextSourceColumn);
					}
					previewerLine.remove();
				}
			});
	};

	const renderDragPoint = () => {
		// remove all points before render
		select(`.${svgClassName}`).select('.dr').remove();

		const tableRows = document
			.querySelector('.taier__dataSync__targetTable')
			?.querySelector(`.${dragPointClassName}`);

		const perHeight = tableRows?.getBoundingClientRect().height || 0;

		const width =
			document.querySelector(`.${svgClassName}`)?.getBoundingClientRect().width || 0;

		select(`.${svgClassName}`)
			.append('g')
			.attr('class', 'dr')
			.selectAll('g')
			.data(targetCol)
			.enter()
			.append('g')
			.attr('class', 'col-dag-r cursor-crosshair')
			.attr('data-key', (data) => getUniqueKey(data))
			.append('circle')
			.attr('class', 'dag-circle')
			.attr('cx', () => width - 10)
			.attr('cy', (_, i) => perHeight * (i + 1.5))
			.attr('r', 5)
			.attr('stroke-width', 2)
			.attr('stroke', '#fff')
			.attr('fill', 'currentColor');

		bindEventForPoint();
		onUpdateDragPoint?.();
	};

	// Get target table columns
	useEffect(() => {
		// Hive，Impala 作为结果表时，需要获取分区字段
		const targetPart = [
			DATA_SOURCE_ENUM.HIVE1X,
			DATA_SOURCE_ENUM.HIVE,
			DATA_SOURCE_ENUM.HIVE3X,
			DATA_SOURCE_ENUM.SPARKTHRIFT,
		].includes(Number(type));

		if (sourceId !== undefined && table !== undefined) {
			setLoading?.(true);
			api.getOfflineTableColumn({
				sourceId,
				schema,
				tableName: table,
				isIncludePart: targetPart,
			})
				.then((res) => {
					if (res.code === 1) {
						const targetMapCol: IDataColumnsProps[] = value || [];
						// TODO: 暂时无法解决没有连线的自定义列或常量保存的问题
						// 取当前选中数据源的表字段和已连线的字段的并集作为 keymap 的数据
						// 因为可能存在常量或自定义列不存在在「数据源的表字段」中，需要从已连线的字段中获取
						const nextSource: IDataColumnsProps[] = res.data;
						targetMapCol.forEach((col) => {
							if (!nextSource.find((s) => s.key === col.key)) {
								nextSource.push(col);
							}
						});
						setTargetCol(nextSource);
					}
				})
				.finally(() => {
					setLoading?.(false);
				});
		} else {
			setTargetCol([]);
		}

		return () => {
			if (targetCol.length) {
				// Reset fields
				onChange?.([]);
			}
		};
	}, [type, table, schema]);

	useLayoutEffect(() => {
		if (targetCol.length) {
			renderDragPoint();
		}
	}, [targetCol.length]);

	return (
		<Resize onResize={() => renderDragPoint()}>
			<Table
				className="taier__dataSync__targetTable"
				rowKey={(data) => getUniqueKey(data)}
				rowClassName={dragPointClassName}
				dataSource={targetCol}
				size="small"
				pagination={false}
				footer={() => {
					const footerButtonGroups = (
						<Space direction="vertical">
							<Button
								type="text"
								// onClick={() => initAddKeyRow(false)}
								disabled={disabled}
							>
								+添加字段
							</Button>
							<Button
								type="text"
								// onClick={() => handleOpenBatchModal(false)}
								disabled={disabled}
							>
								+文本模式
							</Button>
						</Space>
					);
					return (
						<>
							{(() => {
								switch (type) {
									case DATA_SOURCE_ENUM.FTP:
									case DATA_SOURCE_ENUM.HBASE:
										return footerButtonGroups;
									case DATA_SOURCE_ENUM.HDFS:
									case DATA_SOURCE_ENUM.S3: {
										return fileType !== 'orc' && footerButtonGroups;
									}
									default:
										return null;
								}
							})()}
						</>
					);
				}}
			>
				{(() => {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const operations = (record: IDataColumnsProps, i: number) => (
						<Space>
							<Tooltip title="删除当前列">
								<MinusOutlined
								// onClick={() =>
								// 	onColsChanged?.(record, OPERATOR_TYPE.REMOVE, 'target')
								// }
								/>
							</Tooltip>
							<Tooltip title="编辑当前列">
								<EditOutlined
								// onClick={() => initEditKeyRow(false, sourceCol[i], record)}
								/>
							</Tooltip>
						</Space>
					);

					switch (type) {
						case DATA_SOURCE_ENUM.HDFS:
						case DATA_SOURCE_ENUM.S3: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段名称"
										dataIndex="key"
										key="key"
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val) => val.toUpperCase()}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record, idx) => operations(record, idx)}
									/>
								</>
							);
						}
						case DATA_SOURCE_ENUM.HBASE: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="列族"
										dataIndex="cf"
										key="cf"
									/>
									<Table.Column<IDataColumnsProps>
										title="列名"
										dataIndex="key"
										key="key"
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val) => val.toUpperCase()}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record, idx) => operations(record, idx)}
									/>
								</>
							);
						}
						case DATA_SOURCE_ENUM.FTP: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段名称"
										key="key"
										ellipsis
										dataIndex="key"
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val) => val.toUpperCase()}
									/>
									<Table.Column<IDataColumnsProps>
										title="操作"
										key="action"
										render={(_, record, idx) => operations(record, idx)}
									/>
								</>
							);
						}
						case DATA_SOURCE_ENUM.IMPALA: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段名称"
										key="key"
										dataIndex="key"
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										render={(val, record) => {
											return (
												<>
													{`${val.toUpperCase()}${
														record.isPart ? '(分区字段)' : ''
													}`}
													{record.isPart && (
														<img src="images/primary-key.svg" />
													)}
												</>
											);
										}}
									/>
								</>
							);
						}
						default: {
							return (
								<>
									<Table.Column<IDataColumnsProps>
										title="字段名称"
										dataIndex="key"
										key="key"
										ellipsis
									/>
									<Table.Column<IDataColumnsProps>
										title="类型"
										dataIndex="type"
										key="type"
										ellipsis
										render={(val, record) => {
											return `${val.toUpperCase()}${
												record.isPart ? '(分区字段)' : ''
											}`;
										}}
									/>
								</>
							);
						}
					}
				})()}
			</Table>
		</Resize>
	);
}
