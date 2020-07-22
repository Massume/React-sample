import React from 'react';
import PropTypes from 'prop-types';
import {bem, convertToName} from 'utils';
import './style.styl';

const block = bem('emptyList');

const propTypes = {
  city: PropTypes.string.isRequired,
};

const EmptyList = ({city}) => (
  <div className={block()}>
    <div className={block('titleBlock')}>
      <span className={block('title')}>{`There are no results for "${convertToName(city)}"`}</span>
    </div>
    <div className={block('textBlock')}>
      <span className={block('text')}>Did you want to view property listings for:</span>
    </div>
  </div>
);

EmptyList.propTypes = propTypes;

export default EmptyList;
